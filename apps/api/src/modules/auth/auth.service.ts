import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../../common/crypto/secret-encryption';
import { LoginDto } from './dto/login.dto';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly refreshTtlMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        throw new UnauthorizedException('2FA mal configurado, contacte a un administrador');
      }
      if (!dto.twoFactorCode) {
        return { requiresTwoFactor: true };
      }
      const codeValid = authenticator.check(dto.twoFactorCode, decryptSecret(user.twoFactorSecret));
      if (!codeValid) {
        throw new UnauthorizedException('Código de 2FA inválido');
      }
    }

    const tokens = await this.issueTokens(user.id, user.username, user.role, meta);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
    };
  }

  // Rotación: el refresh token usado se revoca y se emite un par nuevo. Si alguien reutiliza
  // un refresh token ya revocado, se rechaza -- indicio de robo de token.
  async refresh(refreshToken: string, meta: SessionMeta) {
    let payload: { sub: string; username: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: this.config.get('jwt.refreshSecret') });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const session = await this.prisma.userSession.findUnique({ where: { refreshToken } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión inválida o revocada');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(user.id, user.username, user.role, meta);
  }

  async logout(refreshToken: string) {
    const session = await this.prisma.userSession.findUnique({ where: { refreshToken } });
    if (!session || session.revokedAt) return { revoked: false };

    await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  // Historial de sesiones/dispositivos del usuario. Nunca se expone el refreshToken crudo.
  async listSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceLabel: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  // Genera un secret nuevo y lo guarda cifrado (AES-256-GCM, ver secret-encryption.ts) sin
  // activar 2FA todavía -- se activa recién cuando el usuario confirma un código válido en
  // verifyTwoFactor() (evita quedar bloqueado por un QR mal escaneado).
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encryptSecret(secret) } });

    const otpauthUrl = authenticator.keyuri(user.username, 'CloverApp Panamá', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async verifyTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Primero ejecute /auth/2fa/setup');
    }
    if (!authenticator.check(code, decryptSecret(user.twoFactorSecret))) {
      throw new UnauthorizedException('Código inválido');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { twoFactorEnabled: true };
  }

  async disableTwoFactor(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { twoFactorEnabled: false };
  }

  private async issueTokens(userId: string, username: string, role: string, meta: SessionMeta) {
    // jti único: sin esto, dos logins con el mismo `iat` (mismo segundo) producen un JWT
    // idéntico byte a byte y chocan contra el @unique de refresh_token en la base.
    const payload = { sub: userId, username, role, jti: randomUUID() };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpiresIn'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret'),
      expiresIn: this.config.get('jwt.refreshExpiresIn'),
    });

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    return { accessToken, refreshToken };
  }
}
