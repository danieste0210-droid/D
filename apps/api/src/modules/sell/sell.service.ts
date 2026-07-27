import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Vistas de solo lectura sobre ventas para el rol supervisor (varios vendedores a la vez).
// TODO(sell): filtrar por los vendedores asignados a User.supervisorId, no todos los vendedores.
@Injectable()
export class SellService {
  constructor(private readonly prisma: PrismaService) {}

  sells() {
    return this.prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  bySupervisor(supervisorId: string) {
    return this.prisma.sale.findMany({
      where: { seller: { supervisorId } },
      orderBy: { createdAt: 'desc' },
      include: { seller: true },
    });
  }
}
