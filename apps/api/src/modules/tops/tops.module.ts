import { Module } from '@nestjs/common';
import { TopsController } from './tops.controller';
import { TopsService } from './tops.service';

@Module({
  controllers: [TopsController],
  providers: [TopsService],
})
export class TopsModule {}
