import { IsInt, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateClosureDto {
  @IsUUID()
  lotteryId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  // Formato "HH:mm", interpretado siempre en America/Panama (ver TIMEZONE en .env)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  closeTime: string;
}
