import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { UpsertCombinadoMultiplierDto } from './dto/upsert-combinado-multiplier.dto';
import { CombinadoMultipliersService } from './combinado-multipliers.service';

@ApiTags('combinado-multipliers')
@Controller('v1/combinado-multipliers')
export class CombinadoMultipliersController {
  constructor(private readonly service: CombinadoMultipliersService) {}

  @Get()
  findByLottery(@Query('lotteryId') lotteryId: string) {
    return this.service.findByLottery(lotteryId);
  }

  @Put()
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'combinadoMultiplier.upsert', entity: 'CombinadoMultiplier' })
  upsert(@Body() dto: UpsertCombinadoMultiplierDto) {
    return this.service.upsert(dto);
  }
}
