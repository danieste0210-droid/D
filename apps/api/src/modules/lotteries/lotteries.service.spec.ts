import { ConflictException, NotFoundException } from '@nestjs/common';
import { AwardStatus, SaleStatus } from '@prisma/client';

// notifications.service.ts importa expo-server-sdk (paquete ESM) que rompe la transformación
// de Jest si se carga de verdad -- se reemplaza el módulo completo para no depender de él en
// un test unitario que de todas formas inyecta un mock propio de NotificationsService.
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));

import { LotteriesService } from './lotteries.service';

function buildService(overrides: { lottery?: any; result?: any; sales?: any[] } = {}) {
  const lottery = overrides.lottery ?? { id: 'lottery-1', name: 'Chance Demo', payoutMultiplier: 60 };
  const existingResult = overrides.result ?? null;
  const winningSales = overrides.sales ?? [];

  const txAwardCreate = jest.fn().mockResolvedValue(undefined);
  const txResultCreate = jest.fn().mockResolvedValue({ id: 'result-1' });
  const txSaleFindMany = jest.fn().mockResolvedValue(winningSales);

  const tx = {
    result: { create: txResultCreate },
    sale: { findMany: txSaleFindMany },
    award: { create: txAwardCreate },
  };

  const prisma = {
    lottery: { findUnique: jest.fn().mockResolvedValue(lottery) },
    result: { findUnique: jest.fn().mockResolvedValue(existingResult) },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
  };

  const notifications = { sendToUser: jest.fn().mockResolvedValue(undefined) };

  const service = new LotteriesService(prisma as any, notifications as any);
  return { service, prisma, notifications, tx: { txAwardCreate, txResultCreate, txSaleFindMany } };
}

describe('LotteriesService.processAwards', () => {
  const dto = { lotteryId: 'lottery-1', drawDate: '2026-07-27', winningNumber: '23' };

  it('lanza NotFoundException si la lotería no existe', async () => {
    const { service, prisma } = buildService();
    prisma.lottery.findUnique.mockResolvedValue(null);

    await expect(service.processAwards(dto, 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza ConflictException si ya hay un resultado para esa lotería y fecha', async () => {
    const { service } = buildService({ result: { id: 'existing-result' } });

    await expect(service.processAwards(dto, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('calcula el monto del premio como amount * payoutMultiplier', async () => {
    const { service, tx } = buildService({
      lottery: { id: 'lottery-1', name: 'Chance Demo', payoutMultiplier: 60 },
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 10 }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(1);
    expect(tx.txAwardCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        saleId: 'sale-1',
        resultId: 'result-1',
        amount: 600, // 10 * 60
        status: AwardStatus.pending,
      }),
    });
  });

  it('solo considera ventas activas para el número ganador (filtro pasado a Prisma)', async () => {
    const { service, tx } = buildService({ sales: [] });

    await service.processAwards(dto, 'user-1');

    expect(tx.txSaleFindMany).toHaveBeenCalledWith({
      where: { lotteryId: 'lottery-1', numberPlayed: '23', status: SaleStatus.active },
    });
  });

  it('no crea premios si ninguna venta coincide con el número ganador', async () => {
    const { service, tx } = buildService({ sales: [] });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('notifica una sola vez por vendedor aunque tenga varias ventas ganadoras', async () => {
    const { service, notifications } = buildService({
      sales: [
        { id: 'sale-1', sellerId: 'seller-1', amount: 5 },
        { id: 'sale-2', sellerId: 'seller-1', amount: 3 },
        { id: 'sale-3', sellerId: 'seller-2', amount: 2 },
      ],
    });

    await service.processAwards(dto, 'user-1');

    expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    expect(notifications.sendToUser).toHaveBeenCalledWith('seller-1', expect.any(Object));
    expect(notifications.sendToUser).toHaveBeenCalledWith('seller-2', expect.any(Object));
  });
});
