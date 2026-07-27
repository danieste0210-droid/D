import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
