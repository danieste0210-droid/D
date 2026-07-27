import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Ranking de vendedores/números más jugados. Endpoint heredado del sistema original (GET /tops/update).
// TODO(tops): definir si "update" recalcula un materialized view o solo lee agregados en vivo.
@Injectable()
export class TopsService {
  constructor(private readonly prisma: PrismaService) {}

  topSellers(take = 10) {
    return this.prisma.sale.groupBy({
      by: ['sellerId'],
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take,
    });
  }
}
