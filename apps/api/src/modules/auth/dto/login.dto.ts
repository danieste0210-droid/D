import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  // Requerido solo si el usuario tiene 2FA habilitado (ver AuthService.login).
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}
