import { IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import { MatchType } from '@prisma/client';

// Tope de seguridad contra error de digitación (ej. escribir 25000 en vez de 2500) -- muy por
// encima del multiplicador real más alto observado (2500x en 4 cifras exactas a $1).
const MAX_MULTIPLIER = 10000;

export class UpsertPayoutMultiplierDto {
  @IsUUID()
  lotteryId: string;

  // Cantidad de cifras jugadas (2, 3 o 4).
  @IsIn([2, 3, 4])
  digitCount: number;

  // Posición del resultado: 1ra, 2da o 3ra.
  @IsIn([1, 2, 3])
  position: number;

  // "primeras" es un bono exclusivo de los billetes de 4 cifras completas (ver
  // payout-multipliers.service.ts) -- para 2/3 cifras solo aplica "ultimas".
  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @IsNumber()
  @IsPositive()
  @Max(MAX_MULTIPLIER)
  multiplier: number;
}
