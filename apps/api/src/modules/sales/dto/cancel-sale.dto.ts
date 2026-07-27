import { IsString, MinLength } from 'class-validator';

export class CancelSaleDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
