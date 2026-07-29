import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCombinadoMultiplierDto } from './dto/upsert-combinado-multiplier.dto';

@Injectable()
export class CombinadoMultipliersService {
  constructor(private readonly prisma: PrismaService) {}

  findByLottery(lotteryId: string) {
    return this.prisma.combinadoMultiplier.findMany({
      where: { lotteryId },
      orderBy: { digitCount: 'asc' },
    });
  }

  upsert(dto: UpsertCombinadoMultiplierDto) {
    return this.prisma.combinadoMultiplier.upsert({
      where: { lotteryId_digitCount: { lotteryId: dto.lotteryId, digitCount: dto.digitCount } },
      update: { multiplier: dto.multiplier },
      create: dto,
    });
  }
}
