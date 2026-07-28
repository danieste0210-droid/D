import { IsUUID, Matches } from 'class-validator';

export class CreateBlockedNumberDto {
  @IsUUID()
  lotteryId: string;

  @Matches(/^\d{2,4}$/, { message: 'number debe ser numérico, de 2 a 4 cifras' })
  number: string;
}
