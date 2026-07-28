import { IsNumber, IsPositive, IsUUID, Matches } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  lotteryId: string;

  // Quiniela: se juega con 2, 3 o 4 cifras -- determina contra qué multiplicador y qué
  // últimas-N-cifras del resultado se compara (ver lotteries.service.processAwards()).
  @Matches(/^\d{2,4}$/, { message: 'numberPlayed debe ser numérico, de 2 a 4 cifras' })
  numberPlayed: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
