import { IsNumber, IsPositive, IsUUID, Max } from 'class-validator';

// Tope de seguridad contra error de digitación -- ver payout-multipliers/dto para el mismo criterio.
const MAX_MULTIPLIER = 10000;

export class UpsertChance3MultiplierDto {
  @IsUUID()
  lotteryId: string;

  @IsNumber()
  @IsPositive()
  @Max(MAX_MULTIPLIER)
  multiplier: number;
}
