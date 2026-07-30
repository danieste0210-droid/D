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
  { digitCount: 2, position: 1, matchType: 'ultimas', multiplier: 60 },
  { digitCount: 2, position: 2, matchType: 'ultimas', multiplier: 20 },
  { digitCount: 2, position: 3, matchType: 'ultimas', multiplier: 10 },
  { digitCount: 3, position: 1, matchType: 'ultimas', multiplier: 400 },
  { digitCount: 4, position: 1, matchType: 'ultimas', multiplier: 2200 },
  { digitCount: 4, position: 2, matchType: 'ultimas', multiplier: 650 },
  { digitCount: 4, position: 3, matchType: 'ultimas', multiplier: 320 },
];

function buildService(
  overrides: {
    lottery?: any;
    result?: any;
    sales?: any[];
    multipliers?: any[];
    combinadoMultipliers?: any[];
    paletMultipliers?: any[];
  } = {},
) {
  const lottery = overrides.lottery ?? { id: 'lottery-1', name: 'Chance Demo' };
  const existingResult = overrides.result ?? null;
  const sales = overrides.sales ?? [];
  const multipliers = overrides.multipliers ?? DEFAULT_MULTIPLIERS;
  const combinadoMultipliers = overrides.combinadoMultipliers ?? [];
  const paletMultipliers = overrides.paletMultipliers ?? [];

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
    combinadoMultiplier: { findMany: jest.fn().mockResolvedValue(combinadoMultipliers) },
    paletMultiplier: { findMany: jest.fn().mockResolvedValue(paletMultipliers) },
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
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 10, numberPlayed: '1234', betType: 'recto' }],
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
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34', betType: 'recto' }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(1);
    expect(tx.txAwardCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 1, amount: 5 * 60 }), // digitCount 2, position 1
    });
  });

  it('NO gana si coincide con las PRIMERAS cifras en vez de las últimas (sin bono configurado)', async () => {
    const { service, tx } = buildService({
      // firstNumber = "1234" -> primeras 2 cifras "12" (no cuenta, solo las últimas cuentan).
      // secondNumber/thirdNumber elegidos para que ninguno termine en "12" por accidente.
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '12', betType: 'recto' }],
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
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1234', betType: 'recto' }],
    });
    // resultado con posiciones de 1 sola cifra
    const shortDto = { ...dto, firstNumber: '4', secondNumber: '8', thirdNumber: '2' };

    const result = await service.processAwards(shortDto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('no crea award si no coincide con ninguna posición', async () => {
    const { service, tx } = buildService({
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '99', betType: 'recto' }],
    });

    const result = await service.processAwards(dto, 'user-1');

    expect(result.awardsCreated).toBe(0);
    expect(tx.txAwardCreate).not.toHaveBeenCalled();
  });

  it('paga TODAS las posiciones que coincidan, no solo la mejor', async () => {
    // firstNumber "1234" y secondNumber "9934" ambos terminan en "34"
    const dtoMulti = { ...dto, secondNumber: '9934' };
    const { service, tx } = buildService({
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34', betType: 'recto' }],
    });

    const result = await service.processAwards(dtoMulti, 'user-1');

    expect(result.awardsCreated).toBe(2);
    expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 60 }) });
    expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 2, amount: 5 * 20 }) });
  });

  it('no crea award si falta el multiplicador configurado para esa combinación cifras/posición', async () => {
    const { service, tx } = buildService({
      multipliers: [], // ninguna combinación configurada
      sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1234', betType: 'recto' }],
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
        { id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34', betType: 'recto' }, // gana pos 1 y 2
        { id: 'sale-2', sellerId: 'seller-1', amount: 3, numberPlayed: '1234', betType: 'recto' }, // gana pos 1 también
        { id: 'sale-3', sellerId: 'seller-2', amount: 1, numberPlayed: '00', betType: 'recto' }, // no gana
      ],
    });

    await service.processAwards(dtoMulti, 'user-1');

    expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
    expect(notifications.sendToUser).toHaveBeenCalledWith('seller-1', expect.any(Object));
  });

  describe('bono "primeras 3 cifras" (billetes de 4 cifras completas)', () => {
    const multipliersConPrimeras = [
      ...DEFAULT_MULTIPLIERS,
      { digitCount: 4, position: 1, matchType: 'primeras', multiplier: 50 },
    ];

    it('gana el bono si coinciden las primeras 3 cifras aunque no coincidan las últimas 3', async () => {
      // firstNumber "1234" -> primeras 3 = "123". numberPlayed "1239" comparte "123" pero no
      // las últimas cifras (termina en "239", no "234").
      const { service, tx } = buildService({
        multipliers: multipliersConPrimeras,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1239', betType: 'recto' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 1, amount: 5 * 50 }),
      });
    });

    it('un ticket ganador exacto puede cobrar últimas Y primeras a la vez (dos awards)', async () => {
      // numberPlayed "1234" coincide exacto: gana últimas-4 (2200x) y también primeras-3 (50x).
      const { service, tx } = buildService({
        multipliers: multipliersConPrimeras,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1234', betType: 'recto' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(2);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 2200 }) });
      expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 50 }) });
    });

    it('el bono de primeras cifras NO aplica a jugadas de 2 o 3 cifras', async () => {
      // numberPlayed de 3 cifras "123" comparte las "primeras 3" del ganador, pero al no ser un
      // billete de 4 cifras completas no debe activar el bono (solo compara vs. digitCount=3).
      const { service, tx } = buildService({
        multipliers: multipliersConPrimeras,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '123', betType: 'recto' }],
      });
      // firstNumber "1234" -> últimas 3 = "234", no coincide con "123"; tampoco hay multiplicador
      // "ultimas" 3-cifras que dé match, así que no debe generar ningún award.
      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(0);
      expect(tx.txAwardCreate).not.toHaveBeenCalled();
    });
  });

  describe('apuesta Combinado', () => {
    it('gana si alguna permutación de las cifras jugadas coincide con el 1er premio', async () => {
      // firstNumber "1234" -> últimas 3 cifras "234". numberPlayed "423" es permutación de "234".
      const { service, tx } = buildService({
        combinadoMultipliers: [{ digitCount: 3, multiplier: 100 }],
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 2, numberPlayed: '423', betType: 'combinado' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 1, amount: 2 * 100 }),
      });
    });

    it('NO gana si la permutación coincide con el 2do o 3er premio (solo cuenta el 1ro)', async () => {
      // secondNumber "5678" -> últimas 3 "678". numberPlayed "867" es permutación de "678", pero
      // el combinado solo paga contra el 1er premio.
      const { service, tx } = buildService({
        combinadoMultipliers: [{ digitCount: 3, multiplier: 100 }],
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 2, numberPlayed: '867', betType: 'combinado' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(0);
      expect(tx.txAwardCreate).not.toHaveBeenCalled();
    });

    it('no gana si no falta el multiplicador de Combinado para esa cantidad de cifras', async () => {
      const { service, tx } = buildService({
        combinadoMultipliers: [], // sin configurar
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 2, numberPlayed: '423', betType: 'combinado' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(0);
      expect(tx.txAwardCreate).not.toHaveBeenCalled();
    });
  });

  describe('apuesta Palet (cascada de 3 pasos: mayor -> medio -> menor)', () => {
    const paletMultipliers = [
      { tier: 'mayor', multiplier: 1000 },
      { tier: 'medio', multiplier: 500 },
      { tier: 'menor', multiplier: 200 },
    ];

    it('gana premio mayor si coincide con 1er Y 2do premio a la vez', async () => {
      // firstNumber "1234" -> últimas 2 "34". secondNumber "5678" -> últimas 2 "78". No coinciden
      // entre sí, así que se ajusta el dto para que compartan las mismas últimas 2 cifras.
      const paletDto = { ...dto, secondNumber: '9934' }; // últimas 2 de 2do premio = "34" también
      const { service, tx } = buildService({
        paletMultipliers,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 3, numberPlayed: '34', betType: 'palet' }],
      });

      const result = await service.processAwards(paletDto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 1, amount: 3 * 1000 }),
      });
    });

    it('gana premio medio si coincide con 1er Y 3er premio a la vez (no con el 2do)', async () => {
      // firstNumber "1234" -> "34". thirdNumber ajustado para terminar también en "34".
      const paletDto = { ...dto, thirdNumber: '9934' };
      const { service, tx } = buildService({
        paletMultipliers,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 3, numberPlayed: '34', betType: 'palet' }],
      });

      const result = await service.processAwards(paletDto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 2, amount: 3 * 500 }),
      });
    });

    it('gana premio menor si coincide con 2do Y 3er premio a la vez (no con el 1ro)', async () => {
      // secondNumber "5678" -> "78". thirdNumber ajustado para terminar también en "78".
      const paletDto = { ...dto, thirdNumber: '9978' };
      const { service, tx } = buildService({
        paletMultipliers,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 3, numberPlayed: '78', betType: 'palet' }],
      });

      const result = await service.processAwards(paletDto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 3, amount: 3 * 200 }),
      });
    });

    it('si coinciden los 3 premios a la vez, paga SOLO mayor (primero en la cascada, no los tres)', async () => {
      // Los 3 premios terminan en "34": califica para mayor, medio Y menor a la vez, pero la
      // cascada se detiene en el primero que coincide.
      const paletDto = { ...dto, secondNumber: '9934', thirdNumber: '9934' };
      const { service, tx } = buildService({
        paletMultipliers,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 3, numberPlayed: '34', betType: 'palet' }],
      });

      const result = await service.processAwards(paletDto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 1, amount: 3 * 1000 }),
      });
    });

    it('si falta el multiplicador del tier que coincide, no paga nada (no cae al siguiente tier)', async () => {
      // Califica para "mayor", pero mayor no tiene multiplicador configurado -- no debe pagar
      // "medio" ni "menor" como si fuera un fallback, porque el ticket SÍ es mayor.
      const paletDto = { ...dto, secondNumber: '9934' };
      const { service, tx } = buildService({
        paletMultipliers: [{ tier: 'medio', multiplier: 500 }, { tier: 'menor', multiplier: 200 }],
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 3, numberPlayed: '34', betType: 'palet' }],
      });

      const result = await service.processAwards(paletDto, 'user-1');

      expect(result.awardsCreated).toBe(0);
      expect(tx.txAwardCreate).not.toHaveBeenCalled();
    });

    it('NO gana nada si no coincide ningún par', async () => {
      const { service, tx } = buildService({
        paletMultipliers,
        // "34" coincide solo con el 1er premio (firstNumber "1234"), no con el 2do ni el 3ro.
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 3, numberPlayed: '34', betType: 'palet' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(0);
      expect(tx.txAwardCreate).not.toHaveBeenCalled();
    });
  });

  describe('bono "últimas 2 cifras" (billetes de 4 cifras completas)', () => {
    const multipliersConUltimas2 = [
      ...DEFAULT_MULTIPLIERS,
      { digitCount: 4, position: 1, matchType: 'ultimas2', multiplier: 3 },
    ];

    it('gana el bono si coinciden las últimas 2 cifras aunque no coincida el resto', async () => {
      // firstNumber "1234" -> últimas 2 = "34". numberPlayed "9934" comparte "34" pero no
      // coincide exacto (1234 vs 9934) ni en las primeras 3 (123 vs 993).
      const { service, tx } = buildService({
        multipliers: multipliersConUltimas2,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '9934', betType: 'recto' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ position: 1, amount: 5 * 3 }),
      });
    });

    it('un ticket ganador exacto acumula exacto, primeras Y últimas-2 a la vez (tres awards)', async () => {
      const multipliersConTodo = [
        ...DEFAULT_MULTIPLIERS,
        { digitCount: 4, position: 1, matchType: 'primeras', multiplier: 50 },
        { digitCount: 4, position: 1, matchType: 'ultimas2', multiplier: 3 },
      ];
      const { service, tx } = buildService({
        multipliers: multipliersConTodo,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '1234', betType: 'recto' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      expect(result.awardsCreated).toBe(3);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 2200 }) });
      expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 50 }) });
      expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 3 }) });
    });

    it('no aplica a jugadas de 2 o 3 cifras', async () => {
      const { service, tx } = buildService({
        multipliers: multipliersConUltimas2,
        sales: [{ id: 'sale-1', sellerId: 'seller-1', amount: 5, numberPlayed: '34', betType: 'recto' }],
      });

      const result = await service.processAwards(dto, 'user-1');

      // "34" de 2 cifras SÍ gana por la regla normal de últimas-cifras (multiplicador 60 en
      // DEFAULT_MULTIPLIERS), pero NO debe generar un award adicional por "ultimas2" ya que ese
      // bono es exclusivo de digitCount=4.
      expect(result.awardsCreated).toBe(1);
      expect(tx.txAwardCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ position: 1, amount: 5 * 60 }) });
    });
  });
});
