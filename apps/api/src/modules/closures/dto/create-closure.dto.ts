import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateClosureDto {
  @IsUUID()
  lotteryId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  // Modo "Rango": si se define, la lotería solo vende entre openTime y closeTime.
  // Modo "Día" (omitido): vende desde medianoche hasta closeTime.
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  openTime?: string;

  // Formato "HH:mm", interpretado siempre en America/Panama (ver TIMEZONE en .env)
  @IsString()
  @Matches(TIME_REGEX)
  closeTime: string;
}
