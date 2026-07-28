import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsString()
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  // "% GANANCIA" del vendedor sobre sus ventas.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}
