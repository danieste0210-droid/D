import { ConflictException, NotFoundException } from '@nestjs/common';
import { AwardStatus, SaleStatus } from '@prisma/client';

// notifications.service.ts importa expo-server-sdk (paquete ESM) que rompe la transformación
// de Jest si se carga de verdad -- se reemplaza el módulo completo para no depender de él en
// un test unitario que de todas formas inyecta un mock propio de NotificationsService.
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));

import { LotteriesService } from './lotteries.service';

const DEFAULT_MULTIPLIERS = [
  { digitCount: 2, position: 1, multiplier: 60 },
  { digitCount: 2, position: 2, multiplier: 20 },
  { digitCount: 2, position: 3, multiplier: 10 },
  { digitCount: 3, position: 1, multiplier: 400 },
  { digitCount: 4, position: 1, multiplier: 2200 },
  { digitCount: 4, position: 2, multiplier: 650 },
  { digitCount: 4, position: 3, multiplier: 320 },
];

function buildService(overrides: { lottery?: any; result?: any; sales?: any[]; multipliers?: any[] } = {}) {
  const lottery = overrides.lottery ?? { id: 'lottery-1', name: 'Chance Demo' };
  const existingResult = overrides.result ?? null;
  const sales = overrides.sales ?? [];
  const multipliers = overrides.multipliers ?? DEFAULT_MULTIPLIERS;

  const txAwardCreate = jest.fn().mockResolvedValue(undefined);
  const txResultCreate = jest.fn().mockResolvedValue({ id: 'result-1' });
  const txSaleFindMany = jest.fn().mockResolvedValue(sales);

  const tx = {
    result: { create: txResultCreate },
    sale: { findMany: txSaleFindMany },
    award: { create: txAwardCreate },
  };

  const prisma = {
    lottery: { findUnique: jest.fn().mockResolvedValue(lottery) },
    result: { findUnique: jest.fn().mockResolvedValue(existingResult) },
    payoutMultiplier: { findMany: jest.fn().mockResolvedValue(multipliers) },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  };

  const notifications = { sendToUser: jest.fn().mockResolvedValue(undefined) };

  const service = new LotteriesService(prisma as any, notifications as any);
  return { service, prisma, notifications, tx: { txAwardCreate, txResultCreate, txSaleFindMany } };
}

describe('LotteriesService.processAwards', () => {
  // Quiniela: firstNumber "1234" -- las últimas N cifras determinan si un número jugado de N
  // cifras gana contra esta posición.
  const dto = { lotteryId: 'lottery-1', drawDate: '2026-07-27', firstNumber: '1234', secondNumber: '5678', thirdNumber: '9012' };

  it('lanza NotFoundException si la lotería no existe', async () => {
    const { service, prisma } = buildService();
    prisma.lottery.findUnique.mockResolvedValue(null);

    await expect(service.processAwards(dto, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza ConflictException si ya hay un resultado para esa lotería y fecha', async () => {
    const { service } = buildService({ result: { id: 'existing-result' } });

    await expect(service.processAwards(dto, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('gana si el número jugado coincide exacto con una posición (mismas cifras)', async () => {
    const { service, tx } = buildService({
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 10, numberPlayed: '1234' }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(1);
    expect(tx.txAwardCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        saleId: 'sale-1',
        resultId: 'result-1',
        position: 1,
        amount: 10 * 2200, // digitCount 4, position 1
        status: AwardStatus.pending,
      }),
    });
  });

  it('un número jugado de 2 cifras gana si coincide con las ÚLTIMAS 2 cifras del ganador', async () => {
    const { service, tx } = buildService({
      // firstNumber = "1234" -> últimas 2 cifras = "34"
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34' }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(1);
    expect(tx.txAwardCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 1, amount: 5 * 60 }), // digitCount 2, position 1
    });
  });

  it('NO gana si coincide con las PRIMERAS cifras en vez de las últimas', async () => {
    const { service, tx } = buildService({
      // firstNumber = "1234" -> primeras 2 cifras "12" (no cuenta, solo las últimas cuentan).
      // secondNumber/thirdNumber elegidos para que ninguno termine en "12" por accidente.
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '12' }],
    });
    const noCollisionDto = { ...dto, secondNumber: '5678', thirdNumber: '9099' };

    const result = await service.processAwards(noCollisionDto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('un número jugado con más cifras que el resultado nunca gana (no revienta)', async () => {
    const { service, tx } = buildService({
      lottery: { id: 'lottery-1', name: 'Chance Demo' },
      result: null,
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1234' }],
    });
    // resultado con posiciones de 1 sola cifra
    const shortDto = { ...dto, firstNumber: '4', secondNumber: '8', thirdNumber: '2' };

    const result = await service.processAwards(shortDto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('no crea award si no coincide con ninguna posición', async () => {
    const { service, tx } = buildService({
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '99' }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('paga TODAS las posiciones que coincidan, no solo la mejor', async () => {
    // firstNumber "1234" y secondNumber "9934" ambos terminan en "34"
    const dtoMulti = { ...dto, secondNumber: '9934' };
    const { service, tx } = buildService({
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34' }],
    });

    const result = await service.processAwards(dtoMulti, 'user-1');

    expect(result.awardsCreated).toBe(2);
    expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 60 }) });
    expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 2, amount: 5 * 20 }) });
  });

  it('no crea award si falta el multiplicador configurado para esa combinación cifras/posición', async () => {
    const { service, tx } = buildService({
      multipliers: [], // ninguna combinación configurada
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1234' }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('solo considera ventas activas de esa lotería (filtro pasado a Prisma)', async () => {
    const { service, tx } = buildService({ sales: [] });

    await service.processAwards(dto, 'user-1');

    expect(tx.txSaleFindMany).toHaveBeenCalledWith({
      where: { lotteryId: 'lottery-1', status: SaleStatus.active },
    });
  });

  it('notifica una sola vez por vendedor aunque gane en varias posiciones/ventas', async () => {
    const dtoMulti = { ...dto, secondNumber: '9934' };
    const { service, notifications } = buildService({
      sales: [
        { id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34' }, // gana pos 1 y 2
        { id: 'sale-2', sellerId: 'seller-1', amount: 3, numberPlayed: '1234' }, // gana pos 1 también
        { id: 'sale-3', sellerId: 'seller-2', amount: 1, numberPlayed: '00' }, // no gana
      ],
    });

    await service.processAwards(dtoMulti, 'user-1');

    expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
    expect(notifications.sendToUser).toHaveBeenCalledWith('seller-1', expect.any(Object));
  });
});
