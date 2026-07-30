import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches } from 'class-validator';
import { BetType } from '@prisma/client';

export class CreateSaleDto {
  @IsUUID()
  lotteryId: string;

  // recto (default): 2/3/4 cifras contra últimas-cifras (+ bono primeras-cifras en 4).
  // combinado: 3/4 cifras, cubre todas sus permutaciones contra el 1er premio.
  // palet: 2 cifras, gana si coincide con dos posiciones consecutivas a la vez.
  // La longitud exacta esperada de numberPlayed según el tipo se valida en sales.service.
  @IsOptional()
  @IsEnum(BetType)
  betType?: BetType;

  @Matches(/^\d{2,4}$/, { message: 'numberPlayed debe ser numérico, de 2 a 4 cifras' })
  numberPlayed: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;
}
