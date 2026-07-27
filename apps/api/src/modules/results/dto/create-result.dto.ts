import { IsDateString, IsString, IsUUID } from 'class-validator';

export class CreateResultDto {
  @IsUUID()
  lotteryId: string;

  @IsDateString()
  drawDate: string;

  @IsString()
  winningNumber: string;
}
