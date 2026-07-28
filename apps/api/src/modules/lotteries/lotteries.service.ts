import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AwardStatus, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { UpdateLotteryDto } from './dto/update-lottery.dto';
import { ProcessAwardsDto } from './dto/process-awards.dto';

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
  // ventas activas de esa lotería. Regla de coincidencia: un número jugado de N cifras gana
  // contra una posición si coincide con las ÚLTIMAS N cifras de esa posición (String.slice(-N)
  // ya maneja correctamente el caso donde el resultado tiene menos cifras que lo jugado -- nunca
  // hay match en ese caso). Si coincide con varias posiciones, se pagan todas sumadas (varios
  // Award por la misma venta, uno por posición).
  // TODO(awards): si falta el multiplicador configurado para una combinación cifras/posición que
  // sí tuvo ventas, esa combinación no genera premio (no debería pasar si se configuran los
  // multiplicadores de la lotería antes de abrir ventas).
  async processAwards(dto: ProcessAwardsDto, processedById: string) {
    const lottery = await this.getOrThrow(dto.lotteryId);
    const drawDate = new Date(dto.drawDate);

    const existing = await this.prisma.result.findUnique({
      where: { lotteryId_drawDate: { lotteryId: dto.lotteryId, drawDate } },
    });
    if (existing) throw new ConflictException('Ya existe un resultado para esta lotería y fecha');

    const multipliers = await this.prisma.payoutMultiplier.findMany({ where: { lotteryId: dto.lotteryId } });
    const multiplierMap = new Map(multipliers.map((m) => [`${m.digitCount}-${m.position}`, Number(m.multiplier)]));
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

      for (const sale of activeSales) {
        const digitCount = sale.numberPlayed.length;

        for (let position = 1; position <= 3; position++) {
          const winningNumber = winningNumbers[position - 1];
          const matches = winningNumber.slice(-digitCount) === sale.numberPlayed;
          if (!matches) continue;

          const multiplier = multiplierMap.get(`${digitCount}-${position}`);
          if (multiplier == null) continue;

          await tx.award.create({
            data: {
              saleId: sale.id,
              resultId: createdResult.id,
              position,
              amount: Number(sale.amount) * multiplier,
              status: AwardStatus.pending,
            },
          });
          sellerIds.push(sale.sellerId);
          count += 1;
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
