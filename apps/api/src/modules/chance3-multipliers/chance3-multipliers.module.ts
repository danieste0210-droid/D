import { Module } from '@nestjs/common';
import { Chance3MultipliersController } from './chance3-multipliers.controller';
import { Chance3MultipliersService } from './chance3-multipliers.service';

@Module({
  controllers: [Chance3MultipliersController],
  providers: [Chance3MultipliersService],
})
export class Chance3MultipliersModule {}
