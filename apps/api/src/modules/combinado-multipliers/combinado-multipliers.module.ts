import { Module } from '@nestjs/common';
import { CombinadoMultipliersController } from './combinado-multipliers.controller';
import { CombinadoMultipliersService } from './combinado-multipliers.service';

@Module({
  controllers: [CombinadoMultipliersController],
  providers: [CombinadoMultipliersService],
})
export class CombinadoMultipliersModule {}
