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

  findForDay(dayOfWeek: number) {
    return this.prisma.lottery.findMany({
      where: { active: true, closures: { some: { dayOfWeek } } },
      include: { closures: { where: { dayOfWeek } } },
    });
  }

  getResults(lotteryId: string) {
    return this.prisma.result.findMany({ where: { lotteryId }, orderBy: { drawDate: 'desc' } });
  }

  getAwardsForUser(userId: string) {
    return this.prisma.award.findMany({ where: { sale: { sellerId: userId } }, include: { sale: true } });
  }

  // Registra el resultado (quiniela: 3 posiciones ganadoras) y calcula premios para todas las
  // ventas activas de esa lotería, según su tipo de apuesta:
  //
  // - recto: un número jugado de N cifras gana contra una posición si coincide con las ÚLTIMAS
  //   N cifras de esa posición. Si jugó 4 cifras completas, además puede ganar bonos si coinciden
  //   solo las PRIMERAS 3 cifras o solo las ÚLTIMAS 2 cifras (exclusivos de billetes de 4 cifras).
  //   Puede ganar en varias posiciones/categorías a la vez -- se pagan todas sumadas.
  // - combinado: se juegan 3 o 4 cifras y se cubren todas sus permutaciones contra el 1er
  //   premio únicamente ("solo jugás con las últimas cifras de la lotería").
  // - palet: se juegan 2 cifras; cascada de 3 pasos, se paga solo el primero que coincida:
  //   mayor (1er Y 2do premio a la vez), medio (1er Y 3er premio), menor (2do Y 3er premio).
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

    const [rectoMultipliers, combinadoMultipliers, paletMultipliers] = await Promise.all([
      this.prisma.payoutMultiplier.findMany({ where: { lotteryId: dto.lotteryId } }),
      this.prisma.combinadoMultiplier.findMany({ where: { lotteryId: dto.lotteryId } }),
      this.prisma.paletMultiplier.findMany({ where: { lotteryId: dto.lotteryId } }),
    ]);
    const rectoMap = new Map(rectoMultipliers.map((m) => [`${m.digitCount}-${m.position}-${m.matchType}`, Number(m.multiplier)]));
    const combinadoMap = new Map(combinadoMultipliers.map((m) => [m.digitCount, Number(m.multiplier)]));
    const paletMap = new Map(paletMultipliers.map((m) => [m.tier, Number(m.multiplier)]));
    const winningNumbers = [dto.firstNumber, dto.secondNumber, dto.thirdNumber];

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

      const activeSales = await tx.sale.findMany({
        where: { lotteryId: dto.lotteryId, status: SaleStatus.active },
      });

      const sellerIds: string[] = [];
      let count = 0;

      const createAward = async (saleId: string, position: number, multiplier: number, amount: number, sellerId: string) => {
        await tx.award.create({
          data: { saleId, resultId: createdResult.id, position, amount: amount * multiplier, status: AwardStatus.pending },
        });
        sellerIds.push(sellerId);
        count += 1;
      };

      for (const sale of activeSales) {
        const digitCount = sale.numberPlayed.length;
        const amount = Number(sale.amount);

        if (sale.betType === BetType.combinado) {
          // Solo contra el 1er premio ("solo jugás con las últimas cifras de la lotería").
          const winningSlice = winningNumbers[0].slice(-digitCount);
          const multiplier = combinadoMap.get(digitCount);
          if (multiplier != null && isPermutation(sale.numberPlayed, winningSlice)) {
            await createAward(sale.id, 1, multiplier, amount, sale.sellerId);
          }
          continue;
        }

        if (sale.betType === BetType.palet) {
          const [first, second, third] = winningNumbers.map((n) => n.slice(-2));
          // Cascada: se evalúa en este orden y se paga solo el primer par que coincida.
          const cascade: { tier: PaletTier; position: number; matches: boolean }[] = [
            { tier: PaletTier.mayor, position: 1, matches: sale.numberPlayed === first && sale.numberPlayed === second },
            { tier: PaletTier.medio, position: 2, matches: sale.numberPlayed === first && sale.numberPlayed === third },
            { tier: PaletTier.menor, position: 3, matches: sale.numberPlayed === second && sale.numberPlayed === third },
          ];

          for (const step of cascade) {
            if (!step.matches) continue;
            const multiplier = paletMap.get(step.tier);
            if (multiplier != null) {
              await createAward(sale.id, step.position, multiplier, amount, sale.sellerId);
            }
            break; // solo se paga el primer par que coincida, aunque falte su multiplicador.
          }
          continue;
        }

        // recto (default).
        for (let position = 1; position <= 3; position++) {
          const winningNumber = winningNumbers[position - 1];

          const matchesUltimas = winningNumber.slice(-digitCount) === sale.numberPlayed;
          const multiplierUltimas = rectoMap.get(`${digitCount}-${position}-${MatchType.ultimas}`);
          if (matchesUltimas && multiplierUltimas != null) {
            await createAward(sale.id, position, multiplierUltimas, amount, sale.sellerId);
          }

          // Bonos exclusivos de billetes de 4 cifras completas: primeras 3 cifras, últimas 2
          // cifras. Independientes entre sí y del match exacto -- un mismo ticket puede cobrar
          // varios a la vez si sus cifras califican para más de una categoría.
          if (digitCount === 4 && winningNumber.length === 4) {
            const bonuses: { matchType: MatchType; matches: boolean }[] = [
              { matchType: MatchType.primeras, matches: winningNumber.slice(0, 3) === sale.numberPlayed.slice(0, 3) },
              { matchType: MatchType.ultimas2, matches: winningNumber.slice(-2) === sale.numberPlayed.slice(-2) },
            ];
            for (const bonus of bonuses) {
              const multiplier = rectoMap.get(`${digitCount}-${position}-${bonus.matchType}`);
              if (bonus.matches && multiplier != null) {
                await createAward(sale.id, position, multiplier, amount, sale.sellerId);
              }
            }
          }
        }
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
