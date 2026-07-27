// notifications.service.ts importa expo-server-sdk (paquete ESM) que rompe la transformación
// de Jest si se carga de verdad -- ver el mismo mock en lotteries.service.spec.ts.
jest.mock('./notifications.service', () => ({
  NotificationsService: jest.fn(),
}));

import { ClosuresReminderService } from './closures-reminder.service';

// 2024-01-15 es lunes. Panamá es UTC-5 fijo. 15:45 UTC = 10:45 local.
const AT = new Date(Date.UTC(2024, 0, 15, 15, 45, 0));

function buildClosure(overrides: Partial<{ closeTime: string; dayOfWeek: number; lotteryId: string; lotteryName: string; active: boolean; blocked: boolean }> = {}) {
  return {
    id: `closure-${overrides.closeTime ?? '00:00'}`,
    lotteryId: overrides.lotteryId ?? 'lottery-1',
    dayOfWeek: overrides.dayOfWeek ?? 1,
    closeTime: overrides.closeTime ?? '11:00',
    lottery: {
      id: overrides.lotteryId ?? 'lottery-1',
      name: overrides.lotteryName ?? 'Chance Demo',
      active: overrides.active ?? true,
      blocked: overrides.blocked ?? false,
    },
  };
}

function buildService(closures: ReturnType<typeof buildClosure>[], vendors: any[] = []) {
  const prisma = {
    closure: { findMany: jest.fn().mockResolvedValue(closures) },
    user: { findMany: jest.fn().mockResolvedValue(vendors) },
  };
  const notifications = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('America/Panama') };
  const service = new ClosuresReminderService(prisma as any, notifications as any, config as any);
  return { service, prisma, notifications };
}

describe('ClosuresReminderService.notifyUpcomingClosures', () => {
  // AT = 10:45 local. Ventana de aviso: [10:45+15, 10:45+15+5) = [11:00, 11:05).

  it('notifica un cierre que cae justo al inicio de la ventana de 15 min', async () => {
    const closure = buildClosure({ closeTime: '11:00' });
    const { service, notifications } = buildService([closure], [{ id: 'vendor-1' }]);

    const due = await service.notifyUpcomingClosures(AT);

    expect(due).toHaveLength(1);
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({ body: expect.stringContaining('Chance Demo') }),
    );
  });

  it('no notifica un cierre fuera de la ventana (todavía falta más de 15-20 min)', async () => {
    const closure = buildClosure({ closeTime: '11:30' });
    const { service, notifications } = buildService([closure], [{ id: 'vendor-1' }]);

    const due = await service.notifyUpcomingClosures(AT);

    expect(due).toHaveLength(0);
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('no notifica un cierre que ya pasó', async () => {
    const closure = buildClosure({ closeTime: '10:30' });
    const { service, notifications } = buildService([closure], [{ id: 'vendor-1' }]);

    await service.notifyUpcomingClosures(AT);

    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('no notifica si la lotería está inactiva o bloqueada', async () => {
    const inactive = buildClosure({ closeTime: '11:00', lotteryId: 'l-inactive', active: false });
    const blocked = buildClosure({ closeTime: '11:02', lotteryId: 'l-blocked', blocked: true });
    const { service, notifications } = buildService([inactive, blocked], [{ id: 'vendor-1' }]);

    const due = await service.notifyUpcomingClosures(AT);

    expect(due).toHaveLength(0);
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('notifica a todos los vendedores activos con token, uno por cierre due', async () => {
    const closure = buildClosure({ closeTime: '11:00' });
    const { service, notifications } = buildService([closure], [{ id: 'vendor-1' }, { id: 'vendor-2' }]);

    await service.notifyUpcomingClosures(AT);

    expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('solo consulta cierres del día de la semana correcto (filtro pasado a Prisma)', async () => {
    const { service, prisma } = buildService([]);

    await service.notifyUpcomingClosures(AT);

    expect(prisma.closure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dayOfWeek: 1 } }), // 1 = lunes
    );
  });

  it('no consulta vendedores si no hay ningún cierre due (evita un query innecesario)', async () => {
    const closure = buildClosure({ closeTime: '11:30' });
    const { service, prisma } = buildService([closure], [{ id: 'vendor-1' }]);

    await service.notifyUpcomingClosures(AT);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
