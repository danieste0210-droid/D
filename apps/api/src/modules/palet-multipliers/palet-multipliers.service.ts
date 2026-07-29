import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPaletMultiplierDto } from './dto/upsert-palet-multiplier.dto';

@Injectable()
export class PaletMultipliersService {
  constructor(private readonly prisma: PrismaService) {}

  findByLottery(lotteryId: string) {
    return this.prisma.paletMultiplier.findMany({
      where: { lotteryId },
      orderBy: { tier: 'asc' },
    });
  }

  upsert(dto: UpsertPaletMultiplierDto) {
    return this.prisma.paletMultiplier.upsert({
      where: { lotteryId_tier: { lotteryId: dto.lotteryId, tier: dto.tier } },
      update: { multiplier: dto.multiplier },
      create: dto,
    });
  }
}
