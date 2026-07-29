import { IsIn, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class UpsertCombinadoMultiplierDto {
  @IsUUID()
  lotteryId: string;

  // Cantidad de cifras jugadas en el combinado (3 o 4) -- se cubren todas sus permutaciones.
  @IsIn([3, 4])
  digitCount: number;

  @IsNumber()
  @IsPositive()
  multiplier: number;
}
