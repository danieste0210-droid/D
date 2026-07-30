import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SalesService } from './sales.service';

const OPEN_LOTTERY = { id: 'lottery-1', name: 'Chance Demo', active: true, blocked: false, maxAmountPerNumber: null };

function buildService(overrides: { lotteries?: Record<string, any>; blockedNumbers?: Record<string, any>; isOpen?: boolean } = {}) {
  const lotteries = overrides.lotteries ?? { 'lottery-1': OPEN_LOTTERY };
  const blockedNumbers = overrides.blockedNumbers ?? {};
  const isOpen = overrides.isOpen ?? true;

  const saleCreate = jest.fn((args: any) => Promise.resolve({ id: `sale-${Math.random()}`, ...args.data }));
  const saleAggregate = jest.fn().mockResolvedValue({ _sum: { amount: null } });
  const saleFindFirst = jest.fn().mockResolvedValue(null);

  const client = {
    lottery: { findUnique: jest.fn(({ where }: any) => Promise.resolve(lotteries[where.id] ?? null)) },
    blockedNumber: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(blockedNumbers[`${where.lotteryId_number.lotteryId}-${where.lotteryId_number.number}`] ?? null),
      ),
    },
    sale: { create: saleCreate, aggregate: saleAggregate, findFirst: saleFindFirst },
  };

  const prisma = {
    ...client,
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(client)),
  };

  const closures = { isLotteryOpen: jest.fn().mockResolvedValue(isOpen) };

  const service = new SalesService(prisma as any, closures as any);
  return { service, prisma, closures, saleCreate, saleAggregate, saleFindFirst };
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
