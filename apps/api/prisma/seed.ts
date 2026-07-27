import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// UUID fijo pero con nibbles de versión/variante válidos (v4) -- un UUID "todo ceros" falla
// la validación @IsUUID() de class-validator en los DTOs.
const DEMO_LOTTERY_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const passwordHash = await bcrypt.hash('changeme123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      name: 'Super Admin',
      username: 'superadmin',
      passwordHash,
      role: Role.super,
    },
  });

  const vendedor = await prisma.user.upsert({
    where: { username: 'vendedor1' },
    update: {},
    create: {
      name: 'Vendedor Demo',
      username: 'vendedor1',
      passwordHash,
      role: Role.vendedor,
      supervisorId: superAdmin.id,
    },
  });

  const lottery = await prisma.lottery.upsert({
    where: { id: DEMO_LOTTERY_ID },
    update: {},
    create: {
      id: DEMO_LOTTERY_ID,
      name: 'Chance Mediodía',
      active: true,
      maxAmountPerNumber: 500,
    },
  });

  // Cierre permisivo (23:30 todos los días) para que las pruebas manuales/dev no fallen por
  // horario sin importar qué día se corra el seed. Ajustar a horarios reales antes de producción.
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    await prisma.closure.upsert({
      where: { lotteryId_dayOfWeek: { lotteryId: lottery.id, dayOfWeek } },
      update: {},
      create: { lotteryId: lottery.id, dayOfWeek, closeTime: '23:30' },
    });
  }

  console.log('Seed completado:', { superAdmin: superAdmin.username, vendedor: vendedor.username, lottery: lottery.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
