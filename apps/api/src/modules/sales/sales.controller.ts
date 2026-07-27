import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@Controller('v1/sale')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // Un vendedor real no procesa más de ~1 venta cada 1-2s en hora pico; 40/min deja margen
  // generoso mientras limita ráfagas automatizadas.
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('process')
  @Roles(Role.vendedor)
  @Audit({ action: 'sale.create', entity: 'Sale' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.id, dto);
  }

  @Get('sales/all')
  @Roles(Role.super, Role.admin, Role.supervisor)
  findAll() {
    return this.salesService.findAll();
  }

  @Get('sales/search')
  search(@Query() query: SearchSaleDto) {
    return this.salesService.search(query);
  }

  @Get('sales/sumary')
  summary(@Query() query: SearchSaleDto) {
    return this.salesService.summary(query);
  }

  @Get('sales/ultsale')
  @Roles(Role.vendedor)
  lastSale(@CurrentUser() user: AuthenticatedUser) {
    return this.salesService.lastSale(user.id);
  }

  @Delete('sales/delete/:id')
  @Roles(Role.vendedor)
  @Audit({ action: 'sale.cancel', entity: 'Sale' })
  cancelBySeller(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CancelSaleDto) {
    return this.salesService.cancelBySeller(id, user.id, dto.reason);
  }

  @Delete('admin/delete/:id')
  @Roles(Role.super, Role.admin)
  @Audit({ action: 'sale.adminCancel', entity: 'Sale' })
  cancelByAdmin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CancelSaleDto) {
    return this.salesService.cancelByAdmin(id, user.id, dto.reason);
  }
}
