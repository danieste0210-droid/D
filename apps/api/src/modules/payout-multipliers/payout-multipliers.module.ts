import { Module } from '@nestjs/common';
import { PayoutMultipliersController } from './payout-multipliers.controller';
import { PayoutMultipliersService } from './payout-multipliers.service';

@Module({
  controllers: [PayoutMultipliersController],
  providers: [PayoutMultipliersService],
})
export class PayoutMultipliersModule {}
