import { IsDateString, IsUUID, Matches } from 'class-validator';

// Dispara el cálculo de premios (quiniela: 3 posiciones ganadoras, hasta 4 cifras cada una).
export class ProcessAwardsDto {
  @IsUUID()
  lotteryId: string;

  @IsDateString()
  drawDate: string;

  @Matches(/^\d{1,4}$/, { message: 'firstNumber debe ser numérico, de 1 a 4 cifras' })
  firstNumber: string;

  @Matches(/^\d{1,4}$/, { message: 'secondNumber debe ser numérico, de 1 a 4 cifras' })
  secondNumber: string;

  @Matches(/^\d{1,4}$/, { message: 'thirdNumber debe ser numérico, de 1 a 4 cifras' })
  thirdNumber: string;
}
