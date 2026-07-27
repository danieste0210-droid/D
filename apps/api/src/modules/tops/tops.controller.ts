import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TopsService } from './tops.service';

@ApiTags('tops')
@Controller('v1/tops')
@Roles(Role.super, Role.admin, Role.supervisor)
export class TopsController {
  constructor(private readonly topsService: TopsService) {}

  @Get('update')
  update() {
    return this.topsService.topSellers();
  }
}
