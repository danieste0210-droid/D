import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AwardStatus, BetType, MatchType, SaleStatus } from '@prisma/client';
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
  //   N cifras de esa posición. Si jugó 4 cifras completas, además gana un premio menor si
  //   coinciden solo las PRIMERAS 3 cifras (bono exclusivo de los billetes de 4 cifras). Puede
  //   ganar en varias posiciones/categorías a la vez -- se pagan todas sumadas.
  // - combinado: se juegan 3 o 4 cifras y se cubren todas sus permutaciones contra el 1er
  //   premio únicamente ("solo jugás con las últimas cifras de la lotería").
  // - palet: se juegan 2 cifras; gana premio mayor si coincide con 1er Y 2do premio a la vez, o
  //   premio menor si coincide con 2do Y 3er premio a la vez (no ambos).
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
          const mayorMultiplier = paletMap.get('mayor');
          const menorMultiplier = paletMap.get('menor');
          const matchesMayor =
            sale.numberPlayed === winningNumbers[0].slice(-2) && sale.numberPlayed === winningNumbers[1].slice(-2);
          const matchesMenor =
            sale.numberPlayed === winningNumbers[1].slice(-2) && sale.numberPlayed === winningNumbers[2].slice(-2);

          if (matchesMayor && mayorMultiplier != null) {
            await createAward(sale.id, 1, mayorMultiplier, amount, sale.sellerId);
          } else if (matchesMenor && menorMultiplier != null) {
            await createAward(sale.id, 2, menorMultiplier, amount, sale.sellerId);
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

          // Bono "primeras 3 cifras": exclusivo de billetes de 4 cifras completas.
          if (digitCount === 4 && winningNumber.length === 4) {
            const matchesPrimeras = winningNumber.slice(0, 3) === sale.numberPlayed.slice(0, 3);
            const multiplierPrimeras = rectoMap.get(`${digitCount}-${position}-${MatchType.primeras}`);
            if (matchesPrimeras && multiplierPrimeras != null) {
              await createAward(sale.id, position, multiplierPrimeras, amount, sale.sellerId);
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
