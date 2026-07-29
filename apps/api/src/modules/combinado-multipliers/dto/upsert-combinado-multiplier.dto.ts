import { IsIn, IsNumber, IsPositive, IsUUID, Max } from 'class-validator';

// Tope de seguridad contra error de digitación -- ver payout-multipliers/dto para el mismo criterio.
const MAX_MULTIPLIER = 10000;

export class UpsertCombinadoMultiplierDto {
  @IsUUID()
  lotteryId: string;

  // Cantidad de cifras jugadas en el combinado (3 o 4) -- se cubren todas sus permutaciones.
  @IsIn([3, 4])
  digitCount: number;

  @IsNumber()
  @IsPositive()
  @Max(MAX_MULTIPLIER)
  multiplier: number;
}
