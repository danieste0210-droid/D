import { BadRequestException, Injectable } from '@nestjs/common';
import { MatchType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPayoutMultiplierDto } from './dto/upsert-payout-multiplier.dto';

@Injectable()
export class PayoutMultipliersService {
  constructor(private readonly prisma: PrismaService) {}

  findByLottery(lotteryId: string) {
    return this.prisma.payoutMultiplier.findMany({
      where: { lotteryId },
      orderBy: [{ digitCount: 'asc' }, { position: 'asc' }, { matchType: 'asc' }],
    });
  }

  // Guardado individual por celda (cifras x posición x tipo de coincidencia), como en la
  // pantalla "Multiplicadores" de referencia -- cada campo tiene su propio botón "Guardar".
  upsert(dto: UpsertPayoutMultiplierDto) {
    const matchType = dto.matchType ?? MatchType.ultimas;
    // "primeras" (bono de 3 primeras cifras) solo tiene sentido para billetes de 4 cifras
    // completas -- ver enum MatchType en schema.prisma.
    if (matchType === MatchType.primeras && dto.digitCount !== 4) {
      throw new BadRequestException('El bono de "primeras cifras" solo aplica a billetes de 4 cifras');
    }

    return this.prisma.payoutMultiplier.upsert({
      where: {
        lotteryId_digitCount_position_matchType: {
          lotteryId: dto.lotteryId,
          digitCount: dto.digitCount,
          position: dto.position,
          matchType,
        },
      },
      update: { multiplier: dto.multiplier },
      create: { ...dto, matchType },
    });
  }
}
