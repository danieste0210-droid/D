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
  [BetType.chance3]: [3],
};

interface SaleInput {
  lotteryId: string;
  numberPlayed: string;
  amount: number;
  betType: BetType;
  customerName?: string;
  customerPhone?: string;
  batchId: string;
  ticketCode: string;
}

// TODO(sales): impresión de ticket (QR/código de verificación) vía react-native-ble-plx en mobile.
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closures: ClosuresService,
  ) {}

  async create(sellerId: string, dto: CreateSaleDto) {
    return this.createOne(this.prisma, sellerId, {
      ...dto,
      betType: dto.betType ?? BetType.recto,
      batchId: randomUUID(),
      ticketCode: generateTicketCode(),
    });
  }

  // Venta en lote: los mismos números del carrito se juegan en TODAS las loterías seleccionadas
  // (una venta por lotería x tipo-con-monto presente en cada ítem). Todo o nada dentro de una
  // sola transacción -- si un solo ítem falla su validación, no se crea ninguna venta del lote.
  // Todas las líneas resultantes comparten un mismo batchId/ticketCode: para el vendedor y el
  // cliente esto es UNA sola venta, aunque abajo sigan siendo varias filas de Sale (necesario
  // para calcular premios por lotería x tipo de apuesta por separado).
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

    const batchId = randomUUID();
    const ticketCode = generateTicketCode();

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
              batchId,
              ticketCode,
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
            if (item.chance3Amount != null) {
              created.push(
                await this.createOne(tx, sellerId, { ...shared, amount: item.chance3Amount, betType: BetType.chance3 }, { ...precomputed, isBlocked }),
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

    // "Chance de tres cifras" necesita 2do premio para derivar el número ganador -- no aplica a
    // loterías de un solo resultado (ej. El Salvador, resultPositions = 1).
    if (input.betType === BetType.chance3 && lottery.resultPositions < 2) {
      throw new BadRequestException(`${lottery.name} no ofrece chance de tres cifras (lotería de un solo resultado)`);
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
        batchId: input.batchId,
        ticketCode: input.ticketCode,
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

  // Recibo de una venta agrupada: todas las líneas de un mismo batchId (una o varias loterías x
  // tipos de apuesta), agrupadas por lotería, con el snapshot de multiplicadores vigentes para el
  // pie del recibo (ver referencia legado: "2 CIFRAS", "TRIPLE", "PALE").
  async getBatch(batchId: string, requesterId: string, isPrivileged: boolean) {
    const lines = await this.prisma.sale.findMany({
      where: { batchId },
      include: { lottery: true, seller: true },
      orderBy: { createdAt: 'asc' },
    });
    if (lines.length === 0) throw new NotFoundException('Venta no encontrada');

    const first = lines[0];
    if (!isPrivileged && first.sellerId !== requesterId) {
      throw new ForbiddenException('No puedes ver ventas de otro vendedor');
    }

    // Una lotería "quitada" de la venta (removeLotteryFromBatch canceló TODAS sus líneas) ya no
    // debe aparecer en el recibo -- este visor refleja el estado ACTUAL de la venta, no el
    // historial completo de cada línea que alguna vez tuvo.
    const activeLotteryIds = [...new Set(lines.filter((l) => l.status === SaleStatus.active).map((l) => l.lotteryId))];
    const [payoutMultipliers, paletMultipliers, chance3Multipliers] = await Promise.all([
      this.prisma.payoutMultiplier.findMany({ where: { lotteryId: { in: activeLotteryIds } } }),
      this.prisma.paletMultiplier.findMany({ where: { lotteryId: { in: activeLotteryIds } } }),
      this.prisma.chance3Multiplier.findMany({ where: { lotteryId: { in: activeLotteryIds } } }),
    ]);

    const lotteries = activeLotteryIds.map((lotteryId) => {
      const lotteryLines = lines.filter((l) => l.lotteryId === lotteryId && l.status === SaleStatus.active);
      const lottery = lotteryLines[0].lottery;
      const rectoDosCifras = [1, 2, 3].map(
        (position) =>
          Number(
            payoutMultipliers.find(
              (m) => m.lotteryId === lotteryId && m.digitCount === 2 && m.position === position && m.matchType === 'ultimas',
            )?.multiplier ?? 0,
          ),
      );
      const chance3Multiplier = Number(chance3Multipliers.find((m) => m.lotteryId === lotteryId)?.multiplier ?? 0);
      const paletTiers = (['mayor', 'menor'] as const).map(
        (tier) => Number(paletMultipliers.find((m) => m.lotteryId === lotteryId && m.tier === tier)?.multiplier ?? 0),
      );

      return {
        lotteryId,
        lotteryName: lottery.name,
        subtotal: lotteryLines.reduce((sum, l) => sum + Number(l.amount), 0),
        lines: lotteryLines.map((l) => ({ id: l.id, numberPlayed: l.numberPlayed, betType: l.betType, amount: Number(l.amount), status: l.status })),
        multipliers: { rectoDosCifras, chance3Multiplier, paletTiers },
      };
    });

    return {
      batchId,
      ticketCode: first.ticketCode,
      createdAt: first.createdAt,
      sellerName: first.seller.name,
      customerName: first.customerName,
      customerPhone: first.customerPhone,
      // "cancelled" solo si YA NO queda ninguna lotería activa en la venta (se canceló toda, o se
      // fueron quitando una por una hasta no dejar ninguna); mientras quede al menos una, "active".
      status: activeLotteryIds.length === 0 ? SaleStatus.cancelled : SaleStatus.active,
      total: lotteries.reduce((sum, l) => sum + l.subtotal, 0),
      lotteries,
    };
  }

  // Lista agrupada para la pantalla "Ventas" del vendedor: una fila por venta (batchId), no por
  // línea -- ver getBatch() para el detalle completo de una venta puntual.
  async listMyBatches(sellerId: string) {
    const lines = await this.prisma.sale.findMany({
      where: { sellerId },
      include: { lottery: true },
      orderBy: { createdAt: 'desc' },
      take: 500, // TODO(sales): paginar cuando el historial crezca
    });

    const byBatch = new Map<string, typeof lines>();
    for (const line of lines) {
      const group = byBatch.get(line.batchId);
      if (group) group.push(line);
      else byBatch.set(line.batchId, [line]);
    }

    return [...byBatch.entries()].map(([batchId, batchLines]) => {
      const first = batchLines[0];
      // Igual que en getBatch(): una lotería quitada de la venta no debe seguir contando en el
      // total ni en el resumen de loterías de esta fila.
      const activeLines = batchLines.filter((l) => l.status === SaleStatus.active);
      return {
        batchId,
        ticketCode: first.ticketCode,
        createdAt: first.createdAt,
        customerName: first.customerName,
        total: activeLines.reduce((sum, l) => sum + Number(l.amount), 0),
        status: activeLines.length === 0 ? SaleStatus.cancelled : SaleStatus.active,
        lotteryNames: [...new Set(activeLines.map((l) => l.lottery.name))],
      };
    });
  }

  // Cancela TODAS las líneas activas de una venta agrupada en un solo movimiento (todo o nada) --
  // ya no se cancela línea por línea. Un vendedor solo puede cancelar mientras todas las loterías
  // de la venta sigan abiertas; admin/super pueden cancelar aunque ya hayan cerrado (igual que el
  // cancelByAdmin de una sola línea).
  async cancelBatch(batchId: string, requesterId: string, reason: string, isPrivileged: boolean) {
    const lines = await this.prisma.sale.findMany({
      where: { batchId, status: SaleStatus.active },
      include: { lottery: true },
    });
    if (lines.length === 0) throw new NotFoundException('Venta no encontrada o ya está cancelada');
    if (!isPrivileged && lines[0].sellerId !== requesterId) {
      throw new ForbiddenException('No puedes cancelar ventas de otro vendedor');
    }

    if (!isPrivileged) {
      for (const lotteryId of new Set(lines.map((l) => l.lotteryId))) {
        const isOpen = await this.closures.isLotteryOpen(lotteryId);
        if (!isOpen) {
          const lottery = lines.find((l) => l.lotteryId === lotteryId)!.lottery;
          throw new ForbiddenException(`No se puede cancelar: ${lottery.name} ya cerró`);
        }
      }
    }

    await this.prisma.sale.updateMany({
      where: { batchId, status: SaleStatus.active },
      data: { status: SaleStatus.cancelled, cancelledAt: new Date(), cancelledById: requesterId, cancelReason: reason },
    });

    return { batchId, cancelled: lines.length };
  }

  // Agrega una lotería a una venta ya creada, replicando el mismo carrito (números/tipos/montos)
  // que ya juega en las demás loterías del lote -- evita tener que cancelar todo y rehacer la
  // captura solo para sumar una lotería más. Todo o nada, misma validación que createOne.
  async addLotteryToBatch(batchId: string, lotteryId: string, requesterId: string, isPrivileged: boolean) {
    const lines = await this.prisma.sale.findMany({ where: { batchId, status: SaleStatus.active } });
    if (lines.length === 0) throw new NotFoundException('Venta no encontrada o ya está cancelada');
    if (!isPrivileged && lines[0].sellerId !== requesterId) {
      throw new ForbiddenException('No puedes modificar ventas de otro vendedor');
    }
    if (lines.some((l) => l.lotteryId === lotteryId)) {
      throw new BadRequestException('Esa lotería ya está en la venta');
    }

    const { sellerId, ticketCode, customerName, customerPhone } = lines[0];
    const cartLines = lines.filter((l) => l.lotteryId === lines[0].lotteryId);

    const lottery = (await this.prisma.lottery.findUnique({ where: { id: lotteryId } })) ?? undefined;
    const isOpen = await this.closures.isLotteryOpen(lotteryId);
    const blockedNumbers = await this.prisma.blockedNumber.findMany({
      where: { lotteryId, number: { in: cartLines.map((l) => l.numberPlayed) } },
    });
    const blockedSet = new Set(blockedNumbers.map((b) => b.number));

    return this.prisma.$transaction(
      async (tx) => {
        const created = [];
        for (const line of cartLines) {
          created.push(
            await this.createOne(
              tx,
              sellerId,
              {
                lotteryId,
                numberPlayed: line.numberPlayed,
                amount: Number(line.amount),
                betType: line.betType,
                customerName: customerName ?? undefined,
                customerPhone: customerPhone ?? undefined,
                batchId,
                ticketCode,
              },
              { lottery, isOpen, isBlocked: blockedSet.has(line.numberPlayed) },
            ),
          );
        }
        return created;
      },
      { timeout: 15_000 },
    );
  }

  // Quita una lotería de una venta agrupada (cancela solo sus líneas). No permite dejar la venta
  // sin ninguna lotería -- para eso está cancelar la venta completa.
  async removeLotteryFromBatch(batchId: string, lotteryId: string, requesterId: string, isPrivileged: boolean) {
    const allLines = await this.prisma.sale.findMany({
      where: { batchId, status: SaleStatus.active },
      include: { lottery: true },
    });
    if (allLines.length === 0) throw new NotFoundException('Venta no encontrada o ya está cancelada');
    if (!isPrivileged && allLines[0].sellerId !== requesterId) {
      throw new ForbiddenException('No puedes modificar ventas de otro vendedor');
    }

    const targetLines = allLines.filter((l) => l.lotteryId === lotteryId);
    if (targetLines.length === 0) throw new NotFoundException('Esa lotería no está en la venta');

    const remaining = allLines.filter((l) => l.lotteryId !== lotteryId);
    if (remaining.length === 0) {
      throw new BadRequestException('No puedes quitar la única lotería de la venta -- cancela la venta completa en su lugar');
    }

    if (!isPrivileged) {
      const isOpen = await this.closures.isLotteryOpen(lotteryId);
      if (!isOpen) throw new ForbiddenException(`No se puede quitar: ${targetLines[0].lottery.name} ya cerró`);
    }

    await this.prisma.sale.updateMany({
      where: { batchId, lotteryId, status: SaleStatus.active },
      data: { status: SaleStatus.cancelled, cancelledAt: new Date(), cancelledById: requesterId, cancelReason: 'Lotería removida de la venta' },
    });

    return { batchId, lotteryId, removed: targetLines.length };
  }

  // Cancelación por el propio vendedor de una sola línea: solo permitida antes del cierre.
  // TODO(sales): la UI de Ventas ahora cancela por venta agrupada (ver cancelBatch); este
  // endpoint por línea se conserva por compatibilidad pero ya no lo usa la pantalla principal.
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

// Código corto compartido por todas las líneas de una misma venta (lo que ve el cliente en el
// recibo) -- no necesita ser único a nivel de BD, la identidad real de la venta es batchId.
function generateTicketCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
