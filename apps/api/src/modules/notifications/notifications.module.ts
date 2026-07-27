import { Module } from '@nestjs/common';
import { ClosuresReminderService } from './closures-reminder.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService, ClosuresReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
