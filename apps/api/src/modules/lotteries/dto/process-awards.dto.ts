import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

// Dispara el cálculo de premios (quiniela: hasta 3 posiciones ganadoras, hasta 4 cifras cada una).
// segundo/tercer premio son opcionales -- loterías de un solo resultado (ej. El Salvador,
// Lottery.resultPositions = 1) no los envían.
export class ProcessAwardsDto {
  @IsUUID()
  lotteryId: string;

  @IsDateString()
  drawDate: string;

  @Matches(/^\d{1,4}$/, { message: 'firstNumber debe ser numérico, de 1 a 4 cifras' })
  firstNumber: string;

  @IsOptional()
  @Matches(/^\d{1,4}$/, { message: 'secondNumber debe ser numérico, de 1 a 4 cifras' })
  secondNumber?: string;

  @IsOptional()
  @Matches(/^\d{1,4}$/, { message: 'thirdNumber debe ser numérico, de 1 a 4 cifras' })
  thirdNumber?: string;
}
