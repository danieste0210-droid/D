import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AwardStatus, BetType, MatchType, PaletTier, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { UpdateLotteryDto } from './dto/update-lottery.dto';
import { ProcessAwardsDto } from './dto/process-awards.dto';

// Compara si dos cadenas de igual longitud son permutación una de la otra (mismas cifras,
// sin importar el orden) -- usado por las apuestas Combinado.
function isPermutation(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return a.split('').sort().join('') === b.split('').sort().join('');
}

// Aritmética en centavos enteros para el cálculo de premios: nunca se encadenan multiplicaciones
// decimales en JS (que sí podrían arrastrar error de punto flotante). Se escala monto y
// multiplicador a enteros, se multiplican como enteros, y se vuelve a escalar UNA sola vez al
// final con redondeo al centavo más cercano.
function calculatePayout(amount: number, multiplier: number): number {
  const amountCents = Math.round(amount * 100);
  const multiplierCents = Math.round(multiplier * 100);
  const payoutCents = Math.round((amountCents * multiplierCents) / 100);
  return payoutCents / 100;
}

@Injectable()
export class LotteriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  create(dto: CreateLotteryDto) {
    return this.prisma.lottery.create({ data: dto });
  }

  async update(id: string, dto: UpdateLotteryDto) {
    await this.getOrThrow(id);
    return this.prisma.lottery.update({ where: { id }, data: dto });
  }

  async block(id: string) {
    await this.getOrThrow(id);
    return this.prisma.lottery.update({ where: { id }, data: { blocked: true } });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    return this.prisma.lottery.delete({ where: { id } });
  }

  findAll() {
    return this.prisma.lottery.findMany();
  }

  // Loterías vendibles ese día: las que tienen su propio Closure para el día, MÁS las que no
  // tienen excepción propia pero heredan el horario general (ClosureDefault) -- debe reflejar
  // la misma prioridad que ClosuresService.isLotteryOpen(), si no una lotería que solo depende
  // del horario general nunca aparecería como vendible en el paso "Loterías" de Nueva Venta.
  async findForDay(dayOfWeek: number) {
    const [withOwnClosure, defaultForDay] = await Promise.all([
      this.prisma.lottery.findMany({
        where: { active: true, blocked: false, closures: { some: { dayOfWeek } } },
        include: { closures: { where: { dayOfWeek } } },
      }),
      this.prisma.closureDefault.findUnique({ where: { dayOfWeek } }),
    ]);

    if (!defaultForDay) return withOwnClosure;

    const excludedIds = withOwnClosure.map((l) => l.id);
    const viaDefault = await this.prisma.lottery.findMany({
      where: { active: true, blocked: false, id: { notIn: excludedIds } },
    });

    return [...withOwnClosure, ...viaDefault.map((l) => ({ ...l, closures: [defaultForDay] }))];
  }

  getResults(lotteryId: string) {
    return this.prisma.result.findMany({ where: { lotteryId }, orderBy: { drawDate: 'desc' } });
  }

  getAwardsForUser(userId: string) {
    return this.prisma.award.findMany({ where: { sale: { sellerId: userId } }, include: { sale: true } });
  }

  // Registra el resultado (quiniela: hasta 3 posiciones ganadoras -- 1 sola para loterías como
  // El Salvador, ver Lottery.resultPositions) y calcula premios para todas las ventas activas de
  // esa lotería, según su tipo de apuesta:
  //
  // - recto: un número jugado de N cifras gana contra una posición si coincide con las ÚLTIMAS
  //   N cifras de esa posición. Si jugó 4 cifras completas, además puede ganar bonos si coinciden
  //   solo las PRIMERAS 3, solo las ÚLTIMAS 3, o solo las ÚLTIMAS 2 cifras (exclusivos de
  //   billetes de 4 cifras). Puede ganar en varias posiciones/categorías a la vez -- se pagan
  //   todas sumadas (política de acumulación de billete pendiente de confirmar, ver README).
  // - combinado: se juegan 3 o 4 cifras y se cubren todas sus permutaciones contra el 1er
  //   premio únicamente ("solo jugás con las últimas cifras de la lotería").
  // - palet: se juegan 2 cifras; cascada de 2 pasos, se paga solo el primero que coincida:
  //   mayor (1er Y 2do premio, O 1er Y 3er premio, a la vez -- mismo pago), menor (2do Y 3er).
  // - chance3 ("chance de tres cifras"): coincidencia EXACTA (no permutación) contra un número
  //   derivado = últimas 2 cifras del 1er premio + última cifra del 2do premio. No aplica si la
  //   lotería no publica 2do premio (ej. El Salvador).
  //
  // TODO(awards): si falta el multiplicador configurado para una combinación que sí tuvo
  // ventas, esa combinación no genera premio (no debería pasar si se configuran los
  // multiplicadores de la lotería antes de abrir ventas).
  async processAwards(dto: ProcessAwardsDto, processedById: string) {
    const lottery = await this.getOrThrow(dto.lotteryId);
    const drawDate = new Date(dto.drawDate);

    const existing = await this.prisma.result.findUnique({
      where: { lotteryId_drawDate: { lotteryId: dto.lotteryId, drawDate } },
    });
    if (existing) throw new ConflictException('Ya existe un resultado para esta lotería y fecha');

    const [rectoMultipliers, combinadoMultipliers, paletMultipliers, chance3Multiplier] = await Promise.all([
      this.prisma.payoutMultiplier.findMany({ where: { lotteryId: dto.lotteryId } }),
      this.prisma.combinadoMultiplier.findMany({ where: { lotteryId: dto.lotteryId } }),
      this.prisma.paletMultiplier.findMany({ where: { lotteryId: dto.lotteryId } }),
      this.prisma.chance3Multiplier.findUnique({ where: { lotteryId: dto.lotteryId } }),
    ]);
    const rectoMap = new Map(rectoMultipliers.map((m) => [`${m.digitCount}-${m.position}-${m.matchType}`, Number(m.multiplier)]));
    const combinadoMap = new Map(combinadoMultipliers.map((m) => [m.digitCount, Number(m.multiplier)]));
    const paletMap = new Map(paletMultipliers.map((m) => [m.tier, Number(m.multiplier)]));
    const chance3MultiplierValue = chance3Multiplier ? Number(chance3Multiplier.multiplier) : null;
    // secondNumber/thirdNumber pueden faltar (lotería de un solo resultado, ej. El Salvador) --
    // todo lo que dependa de ellos se salta automáticamente más abajo.
    const winningNumbers: (string | undefined)[] = [dto.firstNumber, dto.secondNumber, dto.thirdNumber];

    const { result, winnerSellerIds, awardsCreated } = await this.prisma.$transaction(async (tx) => {
      const createdResult = await tx.result.create({
        data: {
          lotteryId: dto.lotteryId,
          drawDate,
          firstNumber: dto.firstNumber,
          secondNumber: dto.secondNumber,
          thirdNumber: dto.thirdNumber,
          processedById,
        },
      });

      // resolvedResultId: null -- excluye ventas que ya se evaluaron contra un resultado anterior
      // de esta misma lotería. Sin este filtro, una venta que sigue "activa" (status solo cambia
      // al cancelar) se re-evaluaría contra CADA resultado futuro de la lotería indefinidamente,
      // lo cual además de ser incorrecto de negocio puede chocar con la restricción única
      // (sale_id, position) de Award si sus cifras vuelven a coincidir por casualidad.
      const activeSales = await tx.sale.findMany({
        where: { lotteryId: dto.lotteryId, status: SaleStatus.active, resolvedResultId: null },
      });

      const sellerIds: string[] = [];
      let count = 0;

      const createAward = async (saleId: string, position: number, category: string, multiplier: number, amount: number, sellerId: string) => {
        await tx.award.create({
          data: {
            saleId,
            resultId: createdResult.id,
            position,
            category,
            amount: calculatePayout(amount, multiplier),
            status: AwardStatus.pending,
          },
        });
        sellerIds.push(sellerId);
        count += 1;
      };

      for (const sale of activeSales) {
        const digitCount = sale.numberPlayed.length;
        const amount = Number(sale.amount);

        if (sale.betType === BetType.combinado) {
          // Solo contra el 1er premio ("solo jugás con las últimas cifras de la lotería").
          const winningSlice = winningNumbers[0]!.slice(-digitCount);
          const multiplier = combinadoMap.get(digitCount);
          if (multiplier != null && isPermutation(sale.numberPlayed, winningSlice)) {
            await createAward(sale.id, 1, 'combinado', multiplier, amount, sale.sellerId);
          }
          continue;
        }

        if (sale.betType === BetType.chance3) {
          // Número derivado = últimas 2 cifras del 1er premio + última cifra del 2do premio.
          // No aplica si la lotería no publica 2do premio (ej. El Salvador).
          const second = winningNumbers[1];
          if (second == null) continue;
          const derived = winningNumbers[0]!.slice(-2) + second.slice(-1);
          if (chance3MultiplierValue != null && sale.numberPlayed === derived) {
            await createAward(sale.id, 1, 'chance3', chance3MultiplierValue, amount, sale.sellerId);
          }
          continue;
        }

        if (sale.betType === BetType.palet) {
          const [first, second, third] = winningNumbers.map((n) => n?.slice(-2));
          // Cascada de 2 pasos: se evalúa en este orden y se paga solo el primer par que
          // coincida. "mayor" cubre 1er-2do Y 1er-3er por igual (mismo multiplicador).
          const cascade: { tier: PaletTier; position: number; matches: boolean }[] = [
            {
              tier: PaletTier.mayor,
              position: 1,
              matches: (sale.numberPlayed === first && sale.numberPlayed === second) || (sale.numberPlayed === first && sale.numberPlayed === third),
            },
            { tier: PaletTier.menor, position: 2, matches: sale.numberPlayed === second && sale.numberPlayed === third },
          ];

          for (const step of cascade) {
            if (!step.matches) continue;
            const multiplier = paletMap.get(step.tier);
            if (multiplier != null) {
              await createAward(sale.id, step.position, `palet-${step.tier}`, multiplier, amount, sale.sellerId);
            }
            break; // solo se paga el primer par que coincida, aunque falte su multiplicador.
          }
          continue;
        }

        // recto (default).
        for (let position = 1; position <= 3; position++) {
          const winningNumber = winningNumbers[position - 1];
          if (winningNumber == null) continue; // esta lotería no publica esta posición.

          const matchesUltimas = winningNumber.slice(-digitCount) === sale.numberPlayed;
          const multiplierUltimas = rectoMap.get(`${digitCount}-${position}-${MatchType.ultimas}`);
          if (matchesUltimas && multiplierUltimas != null) {
            await createAward(sale.id, position, MatchType.ultimas, multiplierUltimas, amount, sale.sellerId);
          }

          // Bonos exclusivos de billetes de 4 cifras completas: primeras 3, últimas 3, últimas 2
          // cifras. Independientes entre sí y del match exacto -- un mismo ticket puede cobrar
          // varios a la vez si sus cifras califican para más de una categoría.
          if (digitCount === 4 && winningNumber.length === 4) {
            const bonuses: { matchType: MatchType; matches: boolean }[] = [
              { matchType: MatchType.primeras, matches: winningNumber.slice(0, 3) === sale.numberPlayed.slice(0, 3) },
              { matchType: MatchType.ultimas3, matches: winningNumber.slice(-3) === sale.numberPlayed.slice(-3) },
              { matchType: MatchType.ultimas2, matches: winningNumber.slice(-2) === sale.numberPlayed.slice(-2) },
            ];
            for (const bonus of bonuses) {
              const multiplier = rectoMap.get(`${digitCount}-${position}-${bonus.matchType}`);
              if (bonus.matches && multiplier != null) {
                await createAward(sale.id, position, bonus.matchType, multiplier, amount, sale.sellerId);
              }
            }
          }
        }
      }

      // Marca TODAS las ventas evaluadas (ganaron o no) como resueltas contra este resultado, para
      // que no vuelvan a evaluarse ante un resultado futuro de la misma lotería.
      if (activeSales.length > 0) {
        await tx.sale.updateMany({
          where: { id: { in: activeSales.map((s) => s.id) } },
          data: { resolvedResultId: createdResult.id },
        });
      }

      return { result: createdResult, winnerSellerIds: sellerIds, awardsCreated: count };
    });

    // Fuera de la transacción a propósito: un fallo al notificar no debe revertir premios ya
    // confirmados. Un vendedor con varias ventas/posiciones ganadoras recibe un solo push.
    const uniqueSellerIds = [...new Set(winnerSellerIds)];
    await Promise.all(
      uniqueSellerIds.map((sellerId) =>
        this.notifications.sendToUser(sellerId, {
          title: '¡Tienes un premio!',
          body: `Resultado de ${lottery.name} publicado`,
          data: { resultId: result.id, lotteryId: lottery.id },
        }),
      ),
    );

    return { result, awardsCreated };
  }

  private async getOrThrow(id: string) {
    const lottery = await this.prisma.lottery.findUnique({ where: { id } });
    if (!lottery) throw new NotFoundException('Lotería no encontrada');
    return lottery;
  }
}
