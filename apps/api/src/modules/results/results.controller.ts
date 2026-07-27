import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateResultDto } from './dto/create-result.dto';
import { ReverseResultDto } from './dto/reverse-result.dto';
import { ResultsService } from './results.service';

@ApiTags('results')
@Controller('v1/results')
@Roles(Role.super, Role.admin)
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post('create')
  @Audit({ action: 'result.create', entity: 'Result' })
  create(@Body() dto: CreateResultDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resultsService.create(dto, user.id);
  }

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
}
