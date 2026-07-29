import { IsEnum, IsNumber, IsPositive, IsUUID, Max } from 'class-validator';
import { PaletTier } from '@prisma/client';

// Tope de seguridad contra error de digitación -- ver payout-multipliers/dto para el mismo criterio.
const MAX_MULTIPLIER = 10000;

export class UpsertPaletMultiplierDto {
  @IsUUID()
  lotteryId: string;

  // mayor: coincide con 1er Y 2do premio a la vez. menor: coincide con 2do Y 3er premio a la vez.
  @IsEnum(PaletTier)
  tier: PaletTier;

  @IsNumber()
  @IsPositive()
  @Max(MAX_MULTIPLIER)
  multiplier: number;
}
