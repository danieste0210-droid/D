import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateBlockedNumberDto } from './dto/create-blocked-number.dto';
import { BlockedNumbersService } from './blocked-numbers.service';

@ApiTags('blocked-numbers')
@Controller('v1/blocked-numbers')
@Roles(Role.super, Role.admin)
export class BlockedNumbersController {
  constructor(private readonly service: BlockedNumbersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Audit({ action: 'blockedNumber.create', entity: 'BlockedNumber' })
  create(@Body() dto: CreateBlockedNumberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @Delete(':id')
  @Audit({ action: 'blockedNumber.delete', entity: 'BlockedNumber' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
