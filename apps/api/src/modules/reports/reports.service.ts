import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  salesByRange(from: Date, to: Date) {
    return this.prisma.sale.groupBy({
      by: ['sellerId', 'lotteryId'],
      where: { createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: true,
    });
  }

  private salesInRange(from: Date, to: Date) {
    return this.prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { seller: true, lottery: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async salesReportExcel(from: Date, to: Date): Promise<Buffer> {
    const sales = await this.salesInRange(from, to);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ventas');
    sheet.columns = [
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'Vendedor', key: 'seller', width: 24 },
      { header: 'Lotería', key: 'lottery', width: 24 },
      { header: 'Número', key: 'numberPlayed', width: 10 },
      { header: 'Monto', key: 'amount', width: 12 },
      { header: 'Estado', key: 'status', width: 12 },
    ];

    let total = 0;
    for (const sale of sales) {
      const amount = Number(sale.amount);
      total += amount;
      sheet.addRow({
        createdAt: sale.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        seller: sale.seller.name,
        lottery: sale.lottery.name,
        numberPlayed: sale.numberPlayed,
        amount,
        status: sale.status,
      });
    }

    sheet.addRow({});
    const totalRow = sheet.addRow({ seller: 'TOTAL', amount: total });
    totalRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async salesReportPdf(from: Date, to: Date): Promise<Buffer> {
    const sales = await this.salesInRange(from, to);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('CloverApp Panamá — Reporte de ventas', { align: 'center' });
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(`${from.toISOString().slice(0, 10)} a ${to.toISOString().slice(0, 10)}`, { align: 'center' });
      doc.moveDown();
      doc.fillColor('#000000');

      let total = 0;
      sales.forEach((sale) => {
        const amount = Number(sale.amount);
        total += amount;
        const line = `${sale.createdAt.toISOString().slice(0, 16).replace('T', ' ')}  |  ${sale.seller.name}  |  ${sale.lottery.name}  |  #${sale.numberPlayed}  |  $${amount.toFixed(2)}  |  ${sale.status}`;
        doc.fontSize(9).text(line);
      });

      doc.moveDown();
      doc.fontSize(11).text(`Total: $${total.toFixed(2)}`, { align: 'right' });
      doc.end();
    });
  }
}
