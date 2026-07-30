import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BetType, Lottery, Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClosuresService } from '../closures/closures.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateBatchSaleDto } from './dto/create-batch-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';

// Cantidad de cifras esperada según el tipo de apuesta -- ver enum BetType en schema.prisma.
const VALID_DIGIT_COUNTS: Record<BetType, number[]> = {
  [BetType.recto]: [2, 3, 4],
  [BetType.combinado]: [3, 4],
  [BetType.palet]: [2],
};

interface SaleInput {
  lotteryId: string;
  numberPlayed: string;
  amount: number;
  betType: BetType;
  customerName?: string;
  customerPhone?: string;
}

// TODO(sales): impresión de ticket (QR/código de verificación) vía react-native-ble-plx en mobile.
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closures: ClosuresService,
  ) {}

  async create(sellerId: string, dto: CreateSaleDto) {
    return this.createOne(this.prisma, sellerId, { ...dto, betType: dto.betType ?? BetType.recto });
  }

  // Venta en lote: los mismos números del carrito se juegan en TODAS las loterías seleccionadas
  // (una venta por lotería x tipo-con-monto presente en cada ítem). Todo o nada dentro de una
  // sola transacción -- si un solo ítem falla su validación, no se crea ninguna venta del lote.
  //
  // Lotería/horario/números-bloqueados se resuelven ANTES de abrir la transacción: no dependen
  // de las ventas que se están creando, así que no hay razón para pagar esos round-trips a Neon
  // mientras la transacción interactiva sigue abierta. Con varias loterías seleccionadas, hacer
  // esos lookups (2-3 queries cada uno) dentro de la transacción superaba su timeout por defecto
  // de 5000ms ("Transaction already closed... Nms passed") y la venta completa fallaba con 500.
  async createBatch(sellerId: string, dto: CreateBatchSaleDto) {
    const lotteries = await this.prisma.lottery.findMany({ where: { id: { in: dto.lotteryIds } } });
    const lotteryById = new Map(lotteries.map((l) => [l.id, l]));

    const openByLotteryId = new Map<string, boolean>();
    for (const lotteryId of dto.lotteryIds) {
      openByLotteryId.set(lotteryId, await this.closures.isLotteryOpen(lotteryId));
    }

    const numbers = [...new Set(dto.items.map((i) => i.numberPlayed))];
    const blockedNumbers = await this.prisma.blockedNumber.findMany({
      where: { lotteryId: { in: dto.lotteryIds }, number: { in: numbers } },
    });
    const blockedSet = new Set(blockedNumbers.map((b) => `${b.lotteryId}:${b.number}`));

    return this.prisma.$transaction(
      async (tx) => {
        const created = [];
        for (const lotteryId of dto.lotteryIds) {
          const precomputed = {
            lottery: lotteryById.get(lotteryId),
            isOpen: openByLotteryId.get(lotteryId) ?? false,
          };
          for (const item of dto.items) {
            const shared = {
              lotteryId,
              numberPlayed: item.numberPlayed,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
            };
            const isBlocked = blockedSet.has(`${lotteryId}:${item.numberPlayed}`);
            if (item.rectoAmount != null) {
              created.push(
                await this.createOne(tx, sellerId, { ...shared, amount: item.rectoAmount, betType: BetType.recto }, { ...precomputed, isBlocked }),
              );
            }
            if (item.combinadoAmount != null) {
              created.push(
                await this.createOne(tx, sellerId, { ...shared, amount: item.combinadoAmount, betType: BetType.combinado }, { ...precomputed, isBlocked }),
              );
            }
            if (item.paletAmount != null) {
              created.push(
                await this.createOne(tx, sellerId, { ...shared, amount: item.paletAmount, betType: BetType.palet }, { ...precomputed, isBlocked }),
              );
            }
          }
        }
        if (created.length === 0) {
          throw new BadRequestException('No hay ningún monto para procesar en el carrito');
        }
        return created;
      },
      { timeout: 15_000 },
    );
  }

  // Núcleo compartido entre create() (una venta) y createBatch() (varias en una transacción).
  // Recibe el cliente de Prisma (normal o de transacción) para que las validaciones y el insert
  // se ejecuten con la misma vista consistente de los datos -- importante para el chequeo de
  // monto máximo por número, que debe ver las ventas ya creadas antes en el mismo lote.
  // `precomputed`, cuando se da (desde createBatch), evita repetir lookups de lotería/horario/
  // bloqueo que ya se resolvieron antes de abrir la transacción.
  private async createOne(
    client: PrismaService | Prisma.TransactionClient,
    sellerId: string,
    input: SaleInput,
    precomputed?: { lottery: Lottery | undefined; isOpen: boolean; isBlocked: boolean },
  ) {
    const validDigitCounts = VALID_DIGIT_COUNTS[input.betType];
    if (!validDigitCounts.includes(input.numberPlayed.length)) {
      throw new BadRequestException(
        `Para ${input.betType} se esperan ${validDigitCounts.join(' o ')} cifras, se recibieron ${input.numberPlayed.length}`,
      );
    }

    const lottery = precomputed ? precomputed.lottery : await client.lottery.findUnique({ where: { id: input.lotteryId } });
    if (!lottery || !lottery.active || lottery.blocked) {
      throw new BadRequestException('Lotería no disponible');
    }

    const isOpen = precomputed ? precomputed.isOpen : await this.closures.isLotteryOpen(input.lotteryId);
    if (!isOpen) {
      throw new ForbiddenException(`${lottery.name} ya cerró para el horario actual`);
    }

    const isBlocked = precomputed
      ? precomputed.isBlocked
      : !!(await client.blockedNumber.findUnique({
          where: { lotteryId_number: { lotteryId: input.lotteryId, number: input.numberPlayed } },
        }));
    if (isBlocked) {
      throw new ForbiddenException(`El número ${input.numberPlayed} está bloqueado para ${lottery.name}`);
    }

    if (lottery.maxAmountPerNumber != null) {
      const alreadyPlayed = await client.sale.aggregate({
        where: { lotteryId: input.lotteryId, numberPlayed: input.numberPlayed, status: SaleStatus.active },
        _sum: { amount: true },
      });
      const projectedTotal = Number(alreadyPlayed._sum.amount ?? 0) + input.amount;
      if (projectedTotal > Number(lottery.maxAmountPerNumber)) {
        throw new ForbiddenException(
          `Monto máximo por número (${lottery.maxAmountPerNumber}) excedido para ${input.numberPlayed} en ${lottery.name}`,
        );
      }
    }

    return client.sale.create({
      data: {
        sellerId,
        lotteryId: input.lotteryId,
        numberPlayed: input.numberPlayed,
        amount: input.amount,
        betType: input.betType,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
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

  // "Última Venta": por defecto hoy, pero acepta una fecha específica (America/Panama, ver
  // toLocalTimeParts) para poder revisar el historial de otro día.
  lastSale(sellerId: string, date?: string) {
    const { gte, lt } = dayBoundsInPanama(date);
    return this.prisma.sale.findFirst({
      where: { sellerId, createdAt: { gte, lt } },
      orderBy: { createdAt: 'desc' },
    });
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

// Rango [inicio del día, inicio del día siguiente) en America/Panama (UTC-5 fijo, sin horario de
// verano) para una fecha "YYYY-MM-DD" (o hoy si no se da ninguna), usado para acotar "Última
// Venta" a un día calendario específico.
function dayBoundsInPanama(date?: string): { gte: Date; lt: Date } {
  const dateStr = date ?? todayInPanama();
  const gte = new Date(`${dateStr}T00:00:00-05:00`);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

function todayInPanama(): string {
  // Locale en-CA formatea como YYYY-MM-DD, cómodo para construir la fecha de vuelta.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date());
}
