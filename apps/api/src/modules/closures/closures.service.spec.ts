import { ClosuresService } from './closures.service';

// 2024-01-15 es lunes. Panamá es UTC-5 fijo (sin horario de verano), así que estos instantes
// UTC se pueden traducir a mano sin depender de la implementación bajo prueba.
const MONDAY_11_29_LOCAL = new Date(Date.UTC(2024, 0, 15, 16, 29, 0)); // 11:29 America/Panama
const MONDAY_11_31_LOCAL = new Date(Date.UTC(2024, 0, 15, 16, 31, 0)); // 11:31 America/Panama
const TUESDAY_11_00_LOCAL = new Date(Date.UTC(2024, 0, 16, 16, 0, 0)); // 11:00 America/Panama, martes

function buildService(prismaOverrides: Record<string, any>) {
  const prisma = {
    lottery: { findUnique: jest.fn() },
    closure: { findUnique: jest.fn().mockResolvedValue(null) },
    closureDefault: { findUnique: jest.fn().mockResolvedValue(null) },
    ...prismaOverrides,
  };
  const config = { get: jest.fn().mockReturnValue('America/Panama') };
  return { service: new ClosuresService(prisma as any, config as any), prisma };
}

describe('ClosuresService.isLotteryOpen', () => {
  it('retorna false si la lotería no existe', async () => {
    const { service, prisma } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    expect(await service.isLotteryOpen('missing-id', MONDAY_11_29_LOCAL)).toBe(false);
    expect(prisma.closure.findUnique).not.toHaveBeenCalled();
  });

  it('retorna false si la lotería está inactiva', async () => {
    const { service } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue({ active: false, blocked: false }) },
    });

    expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(false);
  });

  it('retorna false si la lotería está bloqueada', async () => {
    const { service } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: true }) },
    });

    expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(false);
  });

  it('retorna false si no hay cierre específico NI horario general para ese día', async () => {
    const { service, prisma } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
    });

    expect(await service.isLotteryOpen('id', TUESDAY_11_00_LOCAL)).toBe(false);
    expect(prisma.closure.findUnique).toHaveBeenCalledWith({
      where: { lotteryId_dayOfWeek: { lotteryId: 'id', dayOfWeek: 2 } },
    });
    expect(prisma.closureDefault.findUnique).toHaveBeenCalledWith({ where: { dayOfWeek: 2 } });
  });

  it('retorna true justo antes de la hora de cierre (Closure específico, modo Día)', async () => {
    const { service } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
      closure: { findUnique: jest.fn().mockResolvedValue({ openTime: null, closeTime: '11:30' }) },
    });

    expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(true);
  });

  it('retorna false justo después de la hora de cierre (Closure específico, modo Día)', async () => {
    const { service } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
      closure: { findUnique: jest.fn().mockResolvedValue({ openTime: null, closeTime: '11:30' }) },
    });

    expect(await service.isLotteryOpen('id', MONDAY_11_31_LOCAL)).toBe(false);
  });

  it('usa el día de la semana correcto en America/Panama, no en UTC', async () => {
    // A las 16:29 UTC del lunes 15, ya es 19:29 en zonas UTC+3 y todavía 11:29 en Panamá (UTC-5).
    // Si el servicio usara getUTCDay() en vez de Intl con la zona horaria, este caso fallaría.
    const { service, prisma } = buildService({
      lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
      closure: { findUnique: jest.fn().mockResolvedValue({ openTime: null, closeTime: '11:30' }) },
    });

    await service.isLotteryOpen('id', MONDAY_11_29_LOCAL);
    expect(prisma.closure.findUnique).toHaveBeenCalledWith({
      where: { lotteryId_dayOfWeek: { lotteryId: 'id', dayOfWeek: 1 } }, // 1 = lunes
    });
  });

  describe('horario general (ClosureDefault) como respaldo', () => {
    it('usa el horario general cuando la lotería no tiene Closure específico para ese día', async () => {
      const { service } = buildService({
        lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
        closure: { findUnique: jest.fn().mockResolvedValue(null) },
        closureDefault: { findUnique: jest.fn().mockResolvedValue({ openTime: null, closeTime: '11:30' }) },
      });

      expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(true);
      expect(await service.isLotteryOpen('id', MONDAY_11_31_LOCAL)).toBe(false);
    });

    it('el Closure específico de la lotería tiene prioridad sobre el horario general', async () => {
      // Horario general cierra a las 11:30, pero esta lotería tiene su propio override a las 20:00.
      const { service, prisma } = buildService({
        lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
        closure: { findUnique: jest.fn().mockResolvedValue({ openTime: null, closeTime: '20:00' }) },
        closureDefault: { findUnique: jest.fn().mockResolvedValue({ openTime: null, closeTime: '11:30' }) },
      });

      // 11:31 ya pasó el horario general, pero el override específico sigue abierto.
      expect(await service.isLotteryOpen('id', MONDAY_11_31_LOCAL)).toBe(true);
      expect(prisma.closureDefault.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('modo Rango (openTime definido)', () => {
    it('cerrado antes de openTime', async () => {
      const { service } = buildService({
        lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
        closure: { findUnique: jest.fn().mockResolvedValue({ openTime: '11:30', closeTime: '20:00' }) },
      });

      expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(false);
    });

    it('abierto entre openTime y closeTime', async () => {
      const { service } = buildService({
        lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
        closure: { findUnique: jest.fn().mockResolvedValue({ openTime: '11:00', closeTime: '20:00' }) },
      });

      expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(true);
    });

    it('cerrado después de closeTime aunque esté en modo Rango', async () => {
      const { service } = buildService({
        lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
        closure: { findUnique: jest.fn().mockResolvedValue({ openTime: '08:00', closeTime: '11:30' }) },
      });

      expect(await service.isLotteryOpen('id', MONDAY_11_31_LOCAL)).toBe(false);
    });

    it('el modo Rango también funciona a través del horario general', async () => {
      const { service } = buildService({
        lottery: { findUnique: jest.fn().mockResolvedValue({ active: true, blocked: false }) },
        closure: { findUnique: jest.fn().mockResolvedValue(null) },
        closureDefault: { findUnique: jest.fn().mockResolvedValue({ openTime: '11:30', closeTime: '20:00' }) },
      });

      expect(await service.isLotteryOpen('id', MONDAY_11_29_LOCAL)).toBe(false);
      expect(await service.isLotteryOpen('id', MONDAY_11_31_LOCAL)).toBe(true);
    });
  });
});
