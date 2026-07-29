import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpsertClosureDefaultDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  // Modo "Rango": si se define, el horario general solo aplica entre openTime y closeTime.
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  openTime?: string;

  @IsString()
  @Matches(TIME_REGEX)
  closeTime: string;
}
