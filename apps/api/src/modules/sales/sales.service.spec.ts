import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';

const OPEN_LOTTERY = { id: 'lottery-1', name: 'Chance Demo', active: true, blocked: false, maxAmountPerNumber: null };

function buildService(
  overrides: {
    lotteries?: Record<string, any>;
    blockedNumbers?: Record<string, any>;
    isOpen?: boolean;
    isOpenByLottery?: Record<string, boolean>;
    sales?: any[];
    payoutMultipliers?: any[];
    paletMultipliers?: any[];
    chance3Multipliers?: any[];
  } = {},
) {
  const lotteries = overrides.lotteries ?? { 'lottery-1': OPEN_LOTTERY };
  const blockedNumbers = overrides.blockedNumbers ?? {};
  const isOpen = overrides.isOpen ?? true;
  const isOpenByLottery = overrides.isOpenByLottery ?? {};
  // Clonar cada fila (no solo el array) -- cancelBatch/removeLotteryFromBatch mutan las filas in
  // place vía Object.assign, y varios tests reutilizan el mismo array de fixtures const.
  const salesStore: any[] = overrides.sales ? overrides.sales.map((s) => ({ ...s })) : [];

  const saleCreate = jest.fn((args: any) => {
    const row = { id: `sale-${salesStore.length}-${Math.random()}`, status: 'active', createdAt: new Date(), ...args.data };
    salesStore.push(row);
    return Promise.resolve(row);
  });
  const saleAggregate = jest.fn().mockResolvedValue({ _sum: { amount: null } });
  const saleFindFirst = jest.fn().mockResolvedValue(null);
  const saleFindMany = jest.fn(({ where, include }: any) => {
    let rows = salesStore.filter((r) => {
      if (where?.batchId && r.batchId !== where.batchId) return false;
      if (where?.sellerId && r.sellerId !== where.sellerId) return false;
      if (where?.lotteryId && r.lotteryId !== where.lotteryId) return false;
      if (where?.status && r.status !== where.status) return false;
      return true;
    });
    if (include?.lottery) rows = rows.map((r) => ({ ...r, lottery: lotteries[r.lotteryId] }));
    if (include?.seller) rows = rows.map((r) => ({ ...r, seller: { id: r.sellerId, name: 'Vendedor Test' } }));
    return Promise.resolve(rows);
  });
  const saleUpdateMany = jest.fn(({ where, data }: any) => {
    let count = 0;
    for (const row of salesStore) {
      if (where?.batchId && row.batchId !== where.batchId) continue;
      if (where?.lotteryId && row.lotteryId !== where.lotteryId) continue;
      if (where?.status && row.status !== where.status) continue;
      Object.assign(row, data);
      count++;
    }
    return Promise.resolve({ count });
  });

  const client = {
    lottery: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(lotteries[where.id] ?? null)),
      findMany: jest.fn(({ where }: any) => Promise.resolve(where.id.in.map((id: string) => lotteries[id]).filter(Boolean))),
    },
    blockedNumber: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(blockedNumbers[`${where.lotteryId_number.lotteryId}-${where.lotteryId_number.number}`] ?? null),
      ),
      findMany: jest.fn(({ where }: any) => {
        const lotteryIds: string[] = where.lotteryId?.in ?? [where.lotteryId];
        const numbers: string[] = where.number?.in ?? [where.number];
        return Promise.resolve(
          lotteryIds.flatMap((lotteryId) =>
            numbers
              .filter((number) => blockedNumbers[`${lotteryId}-${number}`])
              .map((number) => ({ ...blockedNumbers[`${lotteryId}-${number}`], lotteryId, number })),
          ),
        );
      }),
    },
    sale: { create: saleCreate, aggregate: saleAggregate, findFirst: saleFindFirst, findMany: saleFindMany, updateMany: saleUpdateMany },
    payoutMultiplier: { findMany: jest.fn().mockResolvedValue(overrides.payoutMultipliers ?? []) },
    paletMultiplier: { findMany: jest.fn().mockResolvedValue(overrides.paletMultipliers ?? []) },
    chance3Multiplier: { findMany: jest.fn().mockResolvedValue(overrides.chance3Multipliers ?? []) },
  };

  const prisma = {
    ...client,
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(client)),
  };

  const closures = { isLotteryOpen: jest.fn((lotteryId: string) => Promise.resolve(isOpenByLottery[lotteryId] ?? isOpen)) };

  const service = new SalesService(prisma as any, closures as any);
  return { service, prisma, closures, saleCreate, saleAggregate, saleFindFirst, saleFindMany, saleUpdateMany, salesStore };
}

describe('SalesService.create', () => {
  it('crea una venta recto normal', async () => {
    const { service, saleCreate } = buildService();

    const sale = await service.create('seller-1', { lotteryId: 'lottery-1', numberPlayed: '34', amount: 5 });

    expect(sale).toBeDefined();
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sellerId: 'seller-1', numberPlayed: '34', amount: 5, betType: 'recto' }),
    });
  });

  it('rechaza si la lotería ya cerró', async () => {
    const { service } = buildService({ isOpen: false });

    await expect(service.create('seller-1', { lotteryId: 'lottery-1', numberPlayed: '34', amount: 5 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza si el número está bloqueado', async () => {
    const { service } = buildService({ blockedNumbers: { 'lottery-1-34': { id: 'blk-1' } } });

    await expect(service.create('seller-1', { lotteryId: 'lottery-1', numberPlayed: '34', amount: 5 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza si la cantidad de cifras no calza con el tipo de apuesta (palet exige 2)', async () => {
    const { service } = buildService();

    await expect(
      service.create('seller-1', { lotteryId: 'lottery-1', numberPlayed: '123', amount: 5, betType: 'palet' as any }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SalesService.createBatch', () => {
  it('crea una venta por cada combinación lotería x tipo-con-monto', async () => {
    const { service, saleCreate } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2', name: 'Otra' } },
    });

    const created = await service.createBatch('seller-1', {
      lotteryIds: ['lottery-1', 'lottery-2'],
      customerName: 'Juan Pérez',
      customerPhone: '6000-0000',
      // "345" (3 cifras) es válido tanto para recto (2/3/4) como para combinado (3/4).
      items: [{ numberPlayed: '345', rectoAmount: 2, combinadoAmount: 1 }],
    });

    // 2 loterías x 2 montos presentes (recto + combinado) = 4 ventas.
    expect(created).toHaveLength(4);
    expect(saleCreate).toHaveBeenCalledTimes(4);
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotteryId: 'lottery-1', betType: 'recto', amount: 2, customerName: 'Juan Pérez', customerPhone: '6000-0000' }),
    });
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotteryId: 'lottery-1', betType: 'combinado', amount: 1 }),
    });
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotteryId: 'lottery-2', betType: 'recto', amount: 2 }),
    });
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotteryId: 'lottery-2', betType: 'combinado', amount: 1 }),
    });
  });

  it('solo crea la venta del tipo cuyo monto está presente (sin combinado ni palet)', async () => {
    const { service, saleCreate } = buildService();

    const created = await service.createBatch('seller-1', {
      lotteryIds: ['lottery-1'],
      items: [{ numberPlayed: '34', rectoAmount: 2 }],
    });

    expect(created).toHaveLength(1);
    expect(saleCreate).toHaveBeenCalledTimes(1);
    expect(saleCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ betType: 'recto', amount: 2 }) });
  });

  it('lanza BadRequestException si ningún ítem tiene monto', async () => {
    const { service } = buildService();

    await expect(
      service.createBatch('seller-1', { lotteryIds: ['lottery-1'], items: [{ numberPlayed: '34' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('todo o nada: si un ítem falla su validación, el lote completo rechaza (no se crea nada)', async () => {
    const { service } = buildService({ blockedNumbers: { 'lottery-1-99': { id: 'blk-1' } } });

    await expect(
      service.createBatch('seller-1', {
        lotteryIds: ['lottery-1'],
        items: [
          { numberPlayed: '34', rectoAmount: 2 }, // válido
          { numberPlayed: '99', rectoAmount: 2 }, // bloqueado -> debe tumbar todo el lote
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('juega los mismos números en TODAS las loterías seleccionadas', async () => {
    const { service, saleCreate } = buildService({
      lotteries: {
        'lottery-1': OPEN_LOTTERY,
        'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2' },
        'lottery-3': { ...OPEN_LOTTERY, id: 'lottery-3' },
      },
    });

    await service.createBatch('seller-1', {
      lotteryIds: ['lottery-1', 'lottery-2', 'lottery-3'],
      items: [{ numberPlayed: '77', rectoAmount: 1 }],
    });

    expect(saleCreate).toHaveBeenCalledTimes(3);
    for (const lotteryId of ['lottery-1', 'lottery-2', 'lottery-3']) {
      expect(saleCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ lotteryId, numberPlayed: '77', amount: 1 }) });
    }
  });
});

describe('SalesService.getBatch', () => {
  const seedSales = [
    { id: 's1', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', customerName: null, customerPhone: null, createdAt: new Date('2026-01-01') },
    { id: 's2', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-2', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', customerName: null, customerPhone: null, createdAt: new Date('2026-01-01') },
  ];

  it('agrupa las líneas por lotería y calcula el total de la venta', async () => {
    const { service } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2', name: 'Otra' } },
      sales: seedSales,
    });

    const batch = await service.getBatch('batch-1', 'seller-1', false);

    expect(batch.total).toBe(4);
    expect(batch.status).toBe('active');
    expect(batch.lotteries).toHaveLength(2);
    expect(batch.lotteries.map((l) => l.lotteryName).sort()).toEqual(['Chance Demo', 'Otra']);
  });

  it('lanza NotFoundException si el batchId no existe', async () => {
    const { service } = buildService({ sales: [] });

    await expect(service.getBatch('no-existe', 'seller-1', false)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza ver la venta de otro vendedor si no es admin/super', async () => {
    const { service } = buildService({ sales: seedSales });

    await expect(service.getBatch('batch-1', 'otro-vendedor', false)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin/super sí puede ver la venta de otro vendedor', async () => {
    const { service } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2', name: 'Otra' } },
      sales: seedSales,
    });

    await expect(service.getBatch('batch-1', 'otro-vendedor', true)).resolves.toBeDefined();
  });
});

describe('SalesService.listMyBatches', () => {
  it('agrupa las ventas del vendedor por batchId, ignorando las de otros', async () => {
    const { service } = buildService({
      sales: [
        { id: 's1', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', customerName: null, createdAt: new Date() },
        { id: 's2', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '35', amount: 3, betType: 'recto', status: 'active', ticketCode: '111111', customerName: null, createdAt: new Date() },
        { id: 's3', batchId: 'batch-2', sellerId: 'otro-vendedor', lotteryId: 'lottery-1', numberPlayed: '36', amount: 1, betType: 'recto', status: 'active', ticketCode: '222222', customerName: null, createdAt: new Date() },
      ],
    });

    const batches = await service.listMyBatches('seller-1');

    expect(batches).toHaveLength(1);
    expect(batches[0].batchId).toBe('batch-1');
    expect(batches[0].total).toBe(5);
  });
});

describe('SalesService.cancelBatch', () => {
  const seedSales = [
    { id: 's1', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', createdAt: new Date() },
    { id: 's2', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-2', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', createdAt: new Date() },
  ];

  it('cancela todas las líneas activas del lote de una vez', async () => {
    const { service, salesStore } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2' } },
      sales: seedSales,
    });

    const result = await service.cancelBatch('batch-1', 'seller-1', 'cliente se arrepintió', false);

    expect(result.cancelled).toBe(2);
    expect(salesStore.every((s) => s.status === 'cancelled')).toBe(true);
  });

  it('lanza NotFoundException si ya no hay líneas activas en el lote', async () => {
    const { service } = buildService({ sales: [] });

    await expect(service.cancelBatch('batch-1', 'seller-1', 'motivo', false)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un vendedor no puede cancelar si alguna lotería del lote ya cerró', async () => {
    const { service } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2' } },
      sales: seedSales,
      isOpenByLottery: { 'lottery-1': true, 'lottery-2': false },
    });

    await expect(service.cancelBatch('batch-1', 'seller-1', 'motivo', false)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin/super puede cancelar aunque alguna lotería ya haya cerrado', async () => {
    const { service, salesStore } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2' } },
      sales: seedSales,
      isOpenByLottery: { 'lottery-1': true, 'lottery-2': false },
    });

    const result = await service.cancelBatch('batch-1', 'admin-1', 'motivo', true);

    expect(result.cancelled).toBe(2);
    expect(salesStore.every((s) => s.status === 'cancelled')).toBe(true);
  });
});

describe('SalesService.addLotteryToBatch', () => {
  it('replica el mismo carrito de la venta en la lotería nueva', async () => {
    const { service, saleCreate } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2', name: 'Nueva' } },
      sales: [
        { id: 's1', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', customerName: 'Juan', customerPhone: null, createdAt: new Date() },
        { id: 's2', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '345', amount: 1, betType: 'combinado', status: 'active', ticketCode: '111111', customerName: 'Juan', customerPhone: null, createdAt: new Date() },
      ],
    });

    const created = await service.addLotteryToBatch('batch-1', 'lottery-2', 'seller-1', false);

    expect(created).toHaveLength(2);
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotteryId: 'lottery-2', betType: 'recto', amount: 2, batchId: 'batch-1', ticketCode: '111111' }),
    });
    expect(saleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotteryId: 'lottery-2', betType: 'combinado', amount: 1 }),
    });
  });

  it('rechaza si la lotería ya está en la venta', async () => {
    const { service } = buildService({
      sales: [
        { id: 's1', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', createdAt: new Date() },
      ],
    });

    await expect(service.addLotteryToBatch('batch-1', 'lottery-1', 'seller-1', false)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SalesService.removeLotteryFromBatch', () => {
  const seedSales = [
    { id: 's1', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-1', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', createdAt: new Date() },
    { id: 's2', batchId: 'batch-1', sellerId: 'seller-1', lotteryId: 'lottery-2', numberPlayed: '34', amount: 2, betType: 'recto', status: 'active', ticketCode: '111111', createdAt: new Date() },
  ];

  it('cancela solo las líneas de la lotería indicada', async () => {
    const { service, salesStore } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY, 'lottery-2': { ...OPEN_LOTTERY, id: 'lottery-2' } },
      sales: seedSales,
    });

    const result = await service.removeLotteryFromBatch('batch-1', 'lottery-2', 'seller-1', false);

    expect(result.removed).toBe(1);
    expect(salesStore.find((s) => s.id === 's1')!.status).toBe('active');
    expect(salesStore.find((s) => s.id === 's2')!.status).toBe('cancelled');
  });

  it('no permite quitar la única lotería restante de la venta', async () => {
    const { service } = buildService({
      lotteries: { 'lottery-1': OPEN_LOTTERY },
      sales: [seedSales[0]],
    });

    await expect(service.removeLotteryFromBatch('batch-1', 'lottery-1', 'seller-1', false)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SalesService.lastSale', () => {
  it('sin fecha, busca dentro del rango de HOY en America/Panama', async () => {
    const { service, saleFindFirst } = buildService();

    await service.lastSale('seller-1');

    expect(saleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sellerId: 'seller-1', createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }) }),
      }),
    );
  });

  it('con fecha explícita, el rango cubre exactamente ese día calendario en Panamá', async () => {
    const { service, saleFindFirst } = buildService();

    await service.lastSale('seller-1', '2026-03-10');

    const call = saleFindFirst.mock.calls[0][0];
    const { gte, lt } = call.where.createdAt;
    // 2026-03-10 00:00 America/Panama (UTC-5) == 2026-03-10T05:00:00Z
    expect(gte.toISOString()).toBe('2026-03-10T05:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-03-11T05:00:00.000Z');
  });
});
