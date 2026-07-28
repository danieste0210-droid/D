import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { UpsertPayoutMultiplierDto } from './dto/upsert-payout-multiplier.dto';
import { PayoutMultipliersService } from './payout-multipliers.service';

@ApiTags('payout-multipliers')
@Controller('v1/payout-multipliers')
export class PayoutMultipliersController {
  constructor(private readonly service: PayoutMultipliersService) {}

  // Lectura abierta a cualquier rol autenticado -- un vendedor puede querer ver las tasas de pago.
  @Get()
  findByLottery(@Query('lotteryId') lotteryId: string) {
    return this.service.findByLottery(lotteryId);
  }

  @Put()
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'payoutMultiplier.upsert', entity: 'PayoutMultiplier' })
  upsert(@Body() dto: UpsertPayoutMultiplierDto) {
    return this.service.upsert(dto);
  }
}
