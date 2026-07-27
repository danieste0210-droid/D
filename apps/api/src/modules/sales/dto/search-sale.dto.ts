import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SearchSaleDto {
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsUUID()
  lotteryId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
