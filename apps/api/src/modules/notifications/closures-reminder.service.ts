import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { closeTimeToMinutes, toLocalTimeParts } from '../../common/time/local-time';
import { NotificationsService } from './notifications.service';

const LEAD_MINUTES = 15;
// Debe calzar con el intervalo del cron de abajo: al barrer en ventanas contiguas de 5 min,
// cada cierre cae en exactamente una ejecución por día -- evita necesitar una tabla de log de
// notificaciones ya enviadas para no duplicar avisos.
const WINDOW_MINUTES = 5;

@Injectable()
export class ClosuresReminderService {
  private readonly logger = new Logger(ClosuresReminderService.name);
  private readonly timezone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('timezone') ?? 'America/Panama';
  }

  @Cron('*/5 * * * *')
  async handleCron() {
    const notified = await this.notifyUpcomingClosures(new Date());
    if (notified.length > 0) {
      this.logger.log(`Avisos de cierre próximo enviados para ${notified.length} lotería(s)`);
    }
  }

  // Separado del @Cron para poder invocarlo directamente en tests/smoke tests sin esperar al reloj real.
  async notifyUpcomingClosures(at: Date) {
    const { dayOfWeek, minutesSinceMidnight } = toLocalTimeParts(at, this.timezone);
    const windowStart = minutesSinceMidnight + LEAD_MINUTES;
    const windowEnd = windowStart + WINDOW_MINUTES;

    const closures = await this.prisma.closure.findMany({
      where: { dayOfWeek },
      include: { lottery: true },
    });

    const due = closures.filter((closure) => {
      if (!closure.lottery.active || closure.lottery.blocked) return false;
      const closeMinutes = closeTimeToMinutes(closure.closeTime);
      return closeMinutes >= windowStart && closeMinutes < windowEnd;
    });

    if (due.length === 0) return due;

    const vendors = await this.prisma.user.findMany({
      where: { role: Role.vendedor, active: true, expoPushToken: { not: null } },
    });

    for (const closure of due) {
      for (const vendor of vendors) {
        await this.notifications.sendToUser(vendor.id, {
          title: 'Cierre próximo',
          body: `${closure.lottery.name} cierra a las ${closure.closeTime}`,
          data: { lotteryId: closure.lotteryId },
        });
      }
    }

    return due;
  }
}
