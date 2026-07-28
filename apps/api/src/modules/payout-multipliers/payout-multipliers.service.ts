import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPayoutMultiplierDto } from './dto/upsert-payout-multiplier.dto';

@Injectable()
export class PayoutMultipliersService {
  constructor(private readonly prisma: PrismaService) {}

  findByLottery(lotteryId: string) {
    return this.prisma.payoutMultiplier.findMany({
      where: { lotteryId },
      orderBy: [{ digitCount: 'asc' }, { position: 'asc' }],
    });
  }

  // Guardado individual por celda (cifras x posición), como en la pantalla "Multiplicadores"
  // de referencia -- cada campo tiene su propio botón "Guardar".
  upsert(dto: UpsertPayoutMultiplierDto) {
    return this.prisma.payoutMultiplier.upsert({
      where: {
        lotteryId_digitCount_position: {
          lotteryId: dto.lotteryId,
          digitCount: dto.digitCount,
          position: dto.position,
        },
      },
      update: { multiplier: dto.multiplier },
      create: dto,
    });
  }
}
