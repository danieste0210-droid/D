import { IsDateString, IsString, IsUUID } from 'class-validator';

// Dispara el cálculo de premios para un sorteo ya registrado en `results`.
export class ProcessAwardsDto {
  @IsUUID()
  lotteryId: string;

  @IsDateString()
  drawDate: string;

  @IsString()
  winningNumber: string;
}
