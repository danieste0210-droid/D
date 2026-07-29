import { IsEnum, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { PaletTier } from '@prisma/client';

export class UpsertPaletMultiplierDto {
  @IsUUID()
  lotteryId: string;

  // mayor: coincide con 1er Y 2do premio a la vez. menor: coincide con 2do Y 3er premio a la vez.
  @IsEnum(PaletTier)
  tier: PaletTier;

  @IsNumber()
  @IsPositive()
  multiplier: number;
}
