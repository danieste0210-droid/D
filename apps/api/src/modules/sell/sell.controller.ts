import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SellService } from './sell.service';

@ApiTags('sell')
@Controller('v1/sell')
@Roles(Role.super, Role.admin, Role.supervisor)
export class SellController {
  constructor(private readonly sellService: SellService) {}

  @Get('sells')
  sells() {
    return this.sellService.sells();
  }

  @Get('superv')
  @Roles(Role.supervisor)
  superv(@CurrentUser() user: AuthenticatedUser) {
    return this.sellService.bySupervisor(user.id);
  }
}
