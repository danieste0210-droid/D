import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClosuresService } from '../closures/closures.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';

// TODO(sales): impresión de ticket (QR/código de verificación) vía react-native-ble-plx en mobile.
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closures: ClosuresService,
  ) {}

  async create(sellerId: string, dto: CreateSaleDto) {
    const lottery = await this.prisma.lottery.findUnique({ where: { id: dto.lotteryId } });
    if (!lottery || !lottery.active || lottery.blocked) {
      throw new BadRequestException('Lotería no disponible');
    }

    const isOpen = await this.closures.isLotteryOpen(dto.lotteryId);
    if (!isOpen) {
      throw new ForbiddenException('La lotería ya cerró para el horario actual');
    }

    const blocked = await this.prisma.blockedNumber.findUnique({
      where: { lotteryId_number: { lotteryId: dto.lotteryId, number: dto.numberPlayed } },
    });
    if (blocked) {
      throw new ForbiddenException(`El número ${dto.numberPlayed} está bloqueado para esta lotería`);
    }

    if (lottery.maxAmountPerNumber != null) {
      const alreadyPlayed = await this.prisma.sale.aggregate({
        where: { lotteryId: dto.lotteryId, numberPlayed: dto.numberPlayed, status: SaleStatus.active },
        _sum: { amount: true },
      });
      const projectedTotal = Number(alreadyPlayed._sum.amount ?? 0) + dto.amount;
      if (projectedTotal > Number(lottery.maxAmountPerNumber)) {
        throw new ForbiddenException(`Monto máximo por número (${lottery.maxAmountPerNumber}) excedido para ${dto.numberPlayed}`);
      }
    }

    return this.prisma.sale.create({
      data: {
        sellerId,
        lotteryId: dto.lotteryId,
        numberPlayed: dto.numberPlayed,
        amount: dto.amount,
        ticketCode: randomUUID(),
        status: SaleStatus.active,
      },
    });
  }

  findAll() {
    return this.prisma.sale.findMany({ orderBy: { createdAt: 'desc' } });
  }

  search(query: SearchSaleDto) {
    return this.prisma.sale.findMany({
      where: {
        sellerId: query.sellerId,
        lotteryId: query.lotteryId,
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  summary(query: SearchSaleDto) {
    return this.prisma.sale.groupBy({
      by: ['sellerId', 'lotteryId'],
      where: {
        sellerId: query.sellerId,
        lotteryId: query.lotteryId,
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      _sum: { amount: true },
      _count: true,
    });
  }

  lastSale(sellerId: string) {
    return this.prisma.sale.findFirst({ where: { sellerId }, orderBy: { createdAt: 'desc' } });
  }

  // Cancelación por el propio vendedor: solo permitida antes del cierre.
  async cancelBySeller(id: string, sellerId: string, reason: string) {
    const sale = await this.getOrThrow(id);
    if (sale.sellerId !== sellerId) throw new ForbiddenException('No puedes cancelar ventas de otro vendedor');

    const isOpen = await this.closures.isLotteryOpen(sale.lotteryId);
    if (!isOpen) throw new ForbiddenException('No se puede cancelar: la lotería ya cerró');

    return this.cancel(sale.id, sellerId, reason);
  }

  // Cancelación administrativa: sin restricción de cierre, siempre auditada.
  async cancelByAdmin(id: string, adminId: string, reason: string) {
    await this.getOrThrow(id);
    return this.cancel(id, adminId, reason);
  }

  private cancel(id: string, cancelledById: string, reason: string) {
    return this.prisma.sale.update({
      where: { id },
      data: {
        status: SaleStatus.cancelled,
        cancelledAt: new Date(),
        cancelledById,
        cancelReason: reason,
      },
    });
  }

  private async getOrThrow(id: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }
}
