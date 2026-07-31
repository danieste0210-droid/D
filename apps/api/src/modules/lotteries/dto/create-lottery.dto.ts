import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLotteryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  maxAmountPerNumber?: number;

  // Cantidad de posiciones de resultado que publica: 3 = estándar (1er/2do/3er premio), 1 = un
  // solo resultado (ej. El Salvador) -- determina qué modalidades se ofrecen para esta lotería.
  @IsOptional()
  @IsIn([1, 3])
  resultPositions?: number;
}
