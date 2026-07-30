import { IsUUID } from 'class-validator';

export class AddLotteryToBatchDto {
  @IsUUID('4')
  lotteryId: string;
}
