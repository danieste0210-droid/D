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

  // Registra el resultado del sorteo y marca como ganadoras (Award, status=pending) todas las
  // ventas activas que coincidan con el número ganador. Todo o nada: si falla cualquier paso,
  // no queda ni el Result ni los Awards a medio crear.
  // TODO(awards): el multiplicador de pago (Lottery.payoutMultiplier) es un placeholder de
  // negocio -- reemplazar por la tabla de pagos real (puede variar por tipo de jugada).
  async processAwards(dto: ProcessAwardsDto, processedById: string) {
    const lottery = await this.getOrThrow(dto.lotteryId);
    const drawDate = new Date(dto.drawDate);

    const existing = await this.prisma.result.findUnique({
      where: { lotteryId_drawDate: { lotteryId: dto.lotteryId, drawDate } },
    });
    if (existing) throw new ConflictException('Ya existe un resultado para esta lotería y fecha');

    const { result, winningSales } = await this.prisma.$transaction(async (tx) => {
      const createdResult = await tx.result.create({
        data: {
          lotteryId: dto.lotteryId,
          drawDate,
          winningNumber: dto.winningNumber,
          processedById,
        },
      });

      const sales = await tx.sale.findMany({
        where: { lotteryId: dto.lotteryId, numberPlayed: dto.winningNumber, status: SaleStatus.active },
      });

      for (const sale of sales) {
        await tx.award.create({
          data: {
            saleId: sale.id,
            resultId: createdResult.id,
            amount: Number(sale.amount) * Number(lottery.payoutMultiplier),
            status: AwardStatus.pending,
          },
        });
      }

      return { result: createdResult, winningSales: sales };
    });

    // Fuera de la transacción a propósito: un fallo al notificar no debe revertir los premios
    // ya confirmados en la base. Un seller con varias ventas ganadoras recibe un solo push.
    const uniqueSellerIds = [...new Set(winningSales.map((s) => s.sellerId))];
    await Promise.all(
      uniqueSellerIds.map((sellerId) =>
        this.notifications.sendToUser(sellerId, {
          title: '¡Tienes un premio!',
          body: `Resultado de ${lottery.name}: número ganador ${dto.winningNumber}`,
          data: { resultId: result.id, lotteryId: lottery.id },
        }),
      ),
    );

    return { result, awardsCreated: winningSales.length };
  }

  private async getOrThrow(id: string) {
    const lottery = await this.prisma.lottery.findUnique({ where: { id } });
    if (!lottery) throw new NotFoundException('Lotería no encontrada');
    return lottery;
  }
}
