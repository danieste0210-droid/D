import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('v1/reports')
@Roles(Role.super, Role.admin, Role.supervisor)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  salesByRange(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.salesByRange(new Date(from), new Date(to));
  }

  @Get('sales/export/excel')
  async exportExcel(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const buffer = await this.reportsService.salesReportExcel(new Date(from), new Date(to));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ventas_${from}_${to}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('sales/export/pdf')
  async exportPdf(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const buffer = await this.reportsService.salesReportPdf(new Date(from), new Date(to));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ventas_${from}_${to}.pdf"`,
    });
    res.send(buffer);
  }
}
