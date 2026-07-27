import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../../prisma/prisma.service';

// TODO(notifications): además de premios, avisar cierre próximo de lotería (requiere un job
// programado -- no hay infraestructura de cron en este esqueleto todavía).
// TODO(notifications): WhatsApp Business API para clientes finales (fuera de alcance: requiere
// cuenta/credenciales de un proveedor, ver README raíz).
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, message: Omit<ExpoPushMessage, 'to'>) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { expoPushToken: true } });
    if (!user?.expoPushToken) return;

    if (!Expo.isExpoPushToken(user.expoPushToken)) {
      this.logger.warn(`Token de push inválido para el usuario ${userId}, se ignora`);
      return;
    }

    const [ticket] = await this.expo.sendPushNotificationsAsync([{ to: user.expoPushToken, ...message }]);
    if (ticket.status === 'error') {
      this.logger.warn(`Fallo al enviar push a ${userId}: ${ticket.message}`);
    }
  }

  async registerToken(userId: string, token: string) {
    if (!Expo.isExpoPushToken(token)) return;
    await this.prisma.user.update({ where: { id: userId }, data: { expoPushToken: token } });
  }
}
