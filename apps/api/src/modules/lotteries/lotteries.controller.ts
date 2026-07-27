import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { UpdateLotteryDto } from './dto/update-lottery.dto';
import { ProcessAwardsDto } from './dto/process-awards.dto';
import { LotteriesService } from './lotteries.service';

@ApiTags('lotteries')
@Controller('v1/lotteries')
export class LotteriesController {
  constructor(private readonly lotteriesService: LotteriesService) {}

  @Post('create')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'lottery.create', entity: 'Lottery' })
  create(@Body() dto: CreateLotteryDto) {
    return this.lotteriesService.create(dto);
  }

  @Patch('edit/:id')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'lottery.edit', entity: 'Lottery' })
  edit(@Param('id') id: string, @Body() dto: UpdateLotteryDto) {
    return this.lotteriesService.update(id, dto);
  }

  @Post('block/:id')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'lottery.block', entity: 'Lottery' })
  block(@Param('id') id: string) {
    return this.lotteriesService.block(id);
  }

  @Delete('delete/:id')
  @Roles(Role.super)
  @Audit({ action: 'lottery.delete', entity: 'Lottery' })
  remove(@Param('id') id: string) {
    return this.lotteriesService.remove(id);
  }

  @Get('all')
  findAll() {
    return this.lotteriesService.findAll();
  }

  @Get('day')
  findForDay(@Query('dayOfWeek') dayOfWeek: string) {
    return this.lotteriesService.findForDay(parseInt(dayOfWeek, 10));
  }

  @Post('process/awards')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'lottery.processAwards', entity: 'Result' })
  processAwards(@Body() dto: ProcessAwardsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lotteriesService.processAwards(dto, user.id);
  }

  @Get('results')
  getResults(@Query('lotteryId') lotteryId: string) {
    return this.lotteriesService.getResults(lotteryId);
  }

  @Get('awards/user')
  getAwardsForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.lotteriesService.getAwardsForUser(user.id);
  }
}
