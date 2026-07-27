import { IsString, MinLength } from 'class-validator';

export class ReverseResultDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
