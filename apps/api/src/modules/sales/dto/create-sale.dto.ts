import { IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  lotteryId: string;

  @IsString()
  numberPlayed: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
