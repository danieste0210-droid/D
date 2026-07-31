import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { UpsertChance3MultiplierDto } from './dto/upsert-chance3-multiplier.dto';
import { Chance3MultipliersService } from './chance3-multipliers.service';

@ApiTags('chance3-multipliers')
@Controller('v1/chance3-multipliers')
export class Chance3MultipliersController {
  constructor(private readonly service: Chance3MultipliersService) {}

  @Get()
  findByLottery(@Query('lotteryId') lotteryId: string) {
    return this.service.findByLottery(lotteryId);
  }

  @Put()
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'chance3Multiplier.upsert', entity: 'Chance3Multiplier' })
  upsert(@Body() dto: UpsertChance3MultiplierDto) {
    return this.service.upsert(dto);
  }
}
