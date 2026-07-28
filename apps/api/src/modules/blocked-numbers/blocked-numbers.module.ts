import { Module } from '@nestjs/common';
import { BlockedNumbersController } from './blocked-numbers.controller';
import { BlockedNumbersService } from './blocked-numbers.service';

@Module({
  controllers: [BlockedNumbersController],
  providers: [BlockedNumbersService],
})
export class BlockedNumbersModule {}
