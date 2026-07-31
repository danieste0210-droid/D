import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ReverseResultDto } from './dto/reverse-result.dto';
import { PayAwardDto } from './dto/pay-award.dto';
import { ResultsService } from './results.service';

// Publicar un resultado nuevo se hace en /lotteries/process/awards (crea el Result Y calcula
// los premios en una sola transacción) -- no hay un endpoint separado "solo crear resultado sin
// premios" a propósito, para no dejar resultados publicados sin sus awards correspondientes.
@ApiTags('results')
@Controller('v1/results')
@Roles(Role.super, Role.admin)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post('reverse/:id')
  @Roles(Role.super)
  @Audit({ action: 'result.reverse', entity: 'Result' })
  reverse(@Param('id') id: string, @Body() dto: ReverseResultDto) {
    return this.resultsService.reverse(id, dto.reason);
  }

  @Get('awards/pending')
  pendingAwards() {
    return this.resultsService.pendingAwards();
  }

  @Post('awards/:id/approve')
  @Audit({ action: 'award.approve', entity: 'Award' })
  approveAward(@Param('id') id: string) {
    return this.resultsService.approve(id);
  }

  @Post('awards/:id/pay')
  @Audit({ action: 'award.pay', entity: 'Award' })
  payAward(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: PayAwardDto) {
    return this.resultsService.pay(id, dto.paymentMethod, user.id);
  }
}
