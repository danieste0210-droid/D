import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateBatchSaleDto } from './dto/create-batch-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { AddLotteryToBatchDto } from './dto/add-lottery-to-batch.dto';
import { SalesService } from './sales.service';

// admin/super pueden operar sobre ventas de cualquier vendedor; un vendedor solo sobre las suyas
// (cada método de SalesService que recibe isPrivileged lo revalida igual del lado del servidor).
function isPrivileged(user: AuthenticatedUser): boolean {
  return user.role === Role.admin || user.role === Role.super;
}

@ApiTags('sales')
@Controller('v1/sale')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // Un vendedor real no procesa más de ~1 venta cada 1-2s en hora pico; 40/min deja margen
  // generoso mientras limita ráfagas automatizadas.
  // El dueño/admin suele también atender el mostrador y vender directamente, no solo el vendedor.
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('process')
  @Roles(Role.vendedor, Role.admin, Role.super)
  @Audit({ action: 'sale.create', entity: 'Sale' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.id, dto);
  }

  // "Números y Valores": un carrito de números se juega en varias loterías a la vez, cada
  // número con montos independientes por tipo de apuesta (recto/combinado/palet).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('process-batch')
  @Roles(Role.vendedor, Role.admin, Role.super)
  @Audit({ action: 'sale.createBatch', entity: 'Sale' })
  createBatch(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBatchSaleDto) {
    return this.salesService.createBatch(user.id, dto);
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
  @Roles(Role.vendedor, Role.admin, Role.super)
  lastSale(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    return this.salesService.lastSale(user.id, date);
  }

  // Pantalla "Ventas": una fila por venta agrupada (batchId), no por línea individual.
  @Get('sales/mybatches')
  @Roles(Role.vendedor, Role.admin, Role.super)
  listMyBatches(@CurrentUser() user: AuthenticatedUser) {
    return this.salesService.listMyBatches(user.id);
  }

  // Recibo de una venta agrupada: detalle completo (loterías, jugadas, multiplicadores vigentes).
  @Get('batch/:batchId')
  @Roles(Role.vendedor, Role.admin, Role.super)
  getBatch(@Param('batchId') batchId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.getBatch(batchId, user.id, isPrivileged(user));
  }

  @Delete('batch/:batchId')
  @Roles(Role.vendedor, Role.admin, Role.super)
  @Audit({ action: 'sale.cancelBatch', entity: 'Sale' })
  cancelBatch(@Param('batchId') batchId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CancelSaleDto) {
    return this.salesService.cancelBatch(batchId, user.id, dto.reason, isPrivileged(user));
  }

  // Agrega una lotería a una venta ya creada, jugando el mismo carrito que ya tiene el lote.
  @Post('batch/:batchId/lotteries')
  @Roles(Role.vendedor, Role.admin, Role.super)
  @Audit({ action: 'sale.addLotteryToBatch', entity: 'Sale' })
  addLotteryToBatch(@Param('batchId') batchId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: AddLotteryToBatchDto) {
    return this.salesService.addLotteryToBatch(batchId, dto.lotteryId, user.id, isPrivileged(user));
  }

  // Quita una lotería de una venta agrupada (cancela solo sus líneas); no deja la venta sin ninguna.
  @Delete('batch/:batchId/lotteries/:lotteryId')
  @Roles(Role.vendedor, Role.admin, Role.super)
  @Audit({ action: 'sale.removeLotteryFromBatch', entity: 'Sale' })
  removeLotteryFromBatch(
    @Param('batchId') batchId: string,
    @Param('lotteryId') lotteryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.removeLotteryFromBatch(batchId, lotteryId, user.id, isPrivileged(user));
  }

  @Delete('sales/delete/:id')
  @Roles(Role.vendedor, Role.admin, Role.super)
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
