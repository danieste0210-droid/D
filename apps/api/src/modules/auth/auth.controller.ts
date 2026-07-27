import { Body, Controller, Get, Ip, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  // Límite más estricto que el global (ver app.module.ts) -- mitiga fuerza bruta de contraseña.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request) {
    return this.authService.login(dto, { ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, { ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  // 2FA disponible solo para admin/super (ver spec: "2FA opcional para admins").
  @Post('2fa/setup')
  @Roles(Role.super, Role.admin)
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupTwoFactor(user.id);
  }

  // Límite estricto: un código TOTP son solo 6 dígitos, sin esto es adivinable por fuerza bruta.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/verify')
  @Roles(Role.super, Role.admin)
  verifyTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyTwoFactorDto) {
    return this.authService.verifyTwoFactor(user.id, dto.code);
  }

  @Post('2fa/disable')
  @Roles(Role.super, Role.admin)
  disableTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.disableTwoFactor(user.id);
  }

  // Registra/actualiza el Expo push token del dispositivo actual. Un login nuevo en otro
  // dispositivo simplemente sobrescribe el token (ver limitación de un solo token por User
  // en schema.prisma -- no es multi-dispositivo real).
  @Post('push-token')
  registerPushToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPushTokenDto) {
    return this.notifications.registerToken(user.id, dto.token);
  }
}
