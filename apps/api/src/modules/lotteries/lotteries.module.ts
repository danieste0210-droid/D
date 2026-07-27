import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LotteriesController } from './lotteries.controller';
import { LotteriesService } from './lotteries.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LotteriesController],
  providers: [LotteriesService],
  exports: [LotteriesService],
})
export class LotteriesModule {}
