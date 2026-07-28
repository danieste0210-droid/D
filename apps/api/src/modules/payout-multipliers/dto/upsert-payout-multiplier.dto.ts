import { IsIn, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class UpsertPayoutMultiplierDto {
  @IsUUID()
  lotteryId: string;

  // Cantidad de cifras jugadas (2, 3 o 4).
  @IsIn([2, 3, 4])
  digitCount: number;

  // Posición del resultado: 1ra, 2da o 3ra.
  @IsIn([1, 2, 3])
  position: number;

  @IsNumber()
  @IsPositive()
  multiplier: number;
}
