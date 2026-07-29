import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { UpsertPaletMultiplierDto } from './dto/upsert-palet-multiplier.dto';
import { PaletMultipliersService } from './palet-multipliers.service';

@ApiTags('palet-multipliers')
@Controller('v1/palet-multipliers')
export class PaletMultipliersController {
  constructor(private readonly service: PaletMultipliersService) {}

  @Get()
  findByLottery(@Query('lotteryId') lotteryId: string) {
    return this.service.findByLottery(lotteryId);
  }

  @Put()
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'paletMultiplier.upsert', entity: 'PaletMultiplier' })
  upsert(@Body() dto: UpsertPaletMultiplierDto) {
    return this.service.upsert(dto);
  }
}
