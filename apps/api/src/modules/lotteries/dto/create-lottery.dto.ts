import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLotteryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  maxAmountPerNumber?: number;
}
