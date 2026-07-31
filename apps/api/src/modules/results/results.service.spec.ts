import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResultsService } from './results.service';

function buildService(overrides: { result?: any; award?: any } = {}) {
  const result = overrides.result;
  const award = overrides.award;

  const prisma: any = {
    result: {
      findUnique: jest.fn().mockResolvedValue(result ?? null),
      update: jest.fn((args: any) => Promise.resolve({ ...result, ...args.data })),
    },
    award: {
      findUnique: jest.fn().mockResolvedValue(award ?? null),
      update: jest.fn((args: any) => Promise.resolve({ ...award, ...args.data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sale: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };

  const service = new ResultsService(prisma as any);
  return { service, prisma };
}

describe('ResultsService.approve', () => {
  it('pasa un premio pendiente a aprobado', async () => {
    const { service, prisma } = buildService({ award: { id: 'award-1', status: 'pending' } });

    await service.approve('award-1');

    expect(prisma.award.update).toHaveBeenCalledWith({ where: { id: 'award-1' }, data: { status: 'approved' } });
  });

  it('lanza NotFoundException si el premio no existe', async () => {
    const { service } = buildService({ award: undefined });

    await expect(service.approve('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza aprobar un premio que no está pendiente (ej. ya pagado)', async () => {
    const { service } = buildService({ award: { id: 'award-1', status: 'paid' } });

    await expect(service.approve('award-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ResultsService.pay', () => {
  it('registra el pago con método, fecha y usuario, desde estado pendiente', async () => {
    const { service, prisma } = buildService({ award: { id: 'award-1', status: 'pending' } });

    await service.pay('award-1', 'yappy' as any, 'admin-1');

    expect(prisma.award.update).toHaveBeenCalledWith({
      where: { id: 'award-1' },
      data: expect.objectContaining({ status: 'paid', paymentMethod: 'yappy', paidById: 'admin-1', paidAt: expect.any(Date) }),
    });
  });

  it('también permite pagar desde estado aprobado', async () => {
    const { service, prisma } = buildService({ award: { id: 'award-1', status: 'approved' } });

    await service.pay('award-1', 'efectivo' as any, 'admin-1');

    expect(prisma.award.update).toHaveBeenCalledWith({
      where: { id: 'award-1' },
      data: expect.objectContaining({ status: 'paid', paymentMethod: 'efectivo' }),
    });
  });

  it('rechaza pagar un premio ya revertido', async () => {
    const { service } = buildService({ award: { id: 'award-1', status: 'reversed' } });

    await expect(service.pay('award-1', 'efectivo' as any, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('lanza NotFoundException si el premio no existe', async () => {
    const { service } = buildService({ award: undefined });

    await expect(service.pay('no-existe', 'efectivo' as any, 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ResultsService.reverse', () => {
  it('rechaza revertir un resultado ya revertido', async () => {
    const { service } = buildService({ result: { id: 'result-1', reversedAt: new Date(), awards: [] } });

    await expect(service.reverse('result-1', 'motivo')).rejects.toBeInstanceOf(ConflictException);
  });

  it('lanza NotFoundException si el resultado no existe', async () => {
    const { service } = buildService({ result: undefined });

    await expect(service.reverse('no-existe', 'motivo')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revierte tanto los premios pendientes como los ya aprobados (ninguno pagado todavía)', async () => {
    const { service, prisma } = buildService({ result: { id: 'result-1', reversedAt: null, awards: [] } });

    await service.reverse('result-1', 'motivo');

    expect(prisma.award.updateMany).toHaveBeenCalledWith({
      where: { resultId: 'result-1', status: { in: ['pending', 'approved'] } },
      data: expect.objectContaining({ status: 'reversed' }),
    });
  });

  it('libera las ventas resueltas contra este resultado para que vuelvan a quedar elegibles', async () => {
    const { service, prisma } = buildService({ result: { id: 'result-1', reversedAt: null, awards: [] } });

    await service.reverse('result-1', 'motivo');

    expect(prisma.sale.updateMany).toHaveBeenCalledWith({
      where: { resolvedResultId: 'result-1' },
      data: { resolvedResultId: null },
    });
  });
});

describe('ResultsService.pendingAwards', () => {
  it('incluye premios pendientes Y aprobados (un aprobado todavía no está pagado)', async () => {
    const { service, prisma } = buildService();

    await service.pendingAwards();

    expect(prisma.award.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['pending', 'approved'] } } }),
    );
  });
});
