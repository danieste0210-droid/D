import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('v1/user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'user.create', entity: 'User' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch('update/:id')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'user.update', entity: 'User' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // Soft-delete (desactivación), nunca borrado físico.
  @Delete('delete/:id')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'user.deactivate', entity: 'User' })
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Get('super')
  @Roles(Role.super)
  findAllActive() {
    return this.usersService.findAllActive();
  }
}
