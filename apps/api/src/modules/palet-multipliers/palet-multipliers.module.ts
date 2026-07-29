import { Module } from '@nestjs/common';
import { PaletMultipliersController } from './palet-multipliers.controller';
import { PaletMultipliersService } from './palet-multipliers.service';

@Module({
  controllers: [PaletMultipliersController],
  providers: [PaletMultipliersService],
})
export class PaletMultipliersModule {}
