import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertChance3MultiplierDto } from './dto/upsert-chance3-multiplier.dto';

// "Chance de tres cifras": un solo multiplicador por lotería (no depende de posición ni cantidad
// de cifras) -- ver lotteries.service.processAwards para la coincidencia exacta contra el número
// derivado (últimas 2 cifras del 1er premio + última cifra del 2do premio).
@Injectable()
export class Chance3MultipliersService {
  constructor(private readonly prisma: PrismaService) {}

  findByLottery(lotteryId: string) {
    return this.prisma.chance3Multiplier.findUnique({ where: { lotteryId } });
  }

  upsert(dto: UpsertChance3MultiplierDto) {
    return this.prisma.chance3Multiplier.upsert({
      where: { lotteryId: dto.lotteryId },
      update: { multiplier: dto.multiplier },
      create: dto,
    });
  }
}
