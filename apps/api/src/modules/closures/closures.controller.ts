import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateClosureDto } from './dto/create-closure.dto';
import { UpdateClosureDto } from './dto/update-closure.dto';
import { ClosuresService } from './closures.service';

@ApiTags('closures')
@Controller('v1/closures')
@Roles(Role.super, Role.admin)
export class ClosuresController {
  constructor(private readonly closuresService: ClosuresService) {}

  @Post('create')
  @Audit({ action: 'closure.create', entity: 'Closure' })
  create(@Body() dto: CreateClosureDto, @CurrentUser() user: AuthenticatedUser) {
    return this.closuresService.create(dto, user.id);
  }

  @Get('getAll')
  @Roles(Role.super, Role.admin, Role.supervisor, Role.vendedor)
  findAll() {
    return this.closuresService.findAll();
  }

  @Patch('update/:id')
  @Audit({ action: 'closure.update', entity: 'Closure' })
  update(@Param('id') id: string, @Body() dto: UpdateClosureDto, @CurrentUser() user: AuthenticatedUser) {
    return this.closuresService.update(id, dto, user.id);
  }

  @Delete('delete/:id')
  @Audit({ action: 'closure.delete', entity: 'Closure' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.closuresService.remove(id, user.id);
  }
}
