import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AwardStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Publicar resultados (con cálculo de premios) vive en lotteries.service.processAwards() --
// este servicio solo maneja reversión y consultas de premios.
@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  // Reversión de un resultado erróneo: nunca se borra, se marca revertido (log inmutable vía
  // AuditInterceptor en el controller). Los awards "pending" asociados se marcan reversed;
  // los que ya estaban "paid" NO se tocan automáticamente -- el dinero ya salió, requieren
  // seguimiento manual, por eso se reportan aparte en la respuesta.
  async reverse(id: string, reason: string) {
    const result = await this.prisma.result.findUnique({ where: { id }, include: { awards: true } });
    if (!result) throw new NotFoundException('Resultado no encontrado');
    if (result.reversedAt) throw new ConflictException('Este resultado ya fue revertido');

    const alreadyPaidAwards = result.awards.filter((a) => a.status === AwardStatus.paid);

    const updatedResult = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.result.update({
        where: { id },
        data: { reversedAt: new Date(), reversalReason: reason },
      });

      await tx.award.updateMany({
        where: { resultId: id, status: AwardStatus.pending },
        data: { status: AwardStatus.reversed, reversedAt: new Date() },
      });

      return updated;
    });

    return {
      result: updatedResult,
      awardsRequiringManualReview: alreadyPaidAwards.map((a) => ({ id: a.id, saleId: a.saleId, amount: a.amount })),
    };
  }

  pendingAwards() {
    return this.prisma.award.findMany({ where: { status: AwardStatus.pending }, include: { sale: true } });
  }

  // pendiente -> aprobado: paso de revisión antes de pagar, no mueve dinero.
  async approve(id: string) {
    const award = await this.getAwardOrThrow(id);
    if (award.status !== AwardStatus.pending) {
      throw new ConflictException('Solo se puede aprobar un premio pendiente');
    }
    return this.prisma.award.update({ where: { id }, data: { status: AwardStatus.approved } });
  }

  // pendiente o aprobado -> pagado: registra método de pago (efectivo/Yappy), quién y cuándo.
  async pay(id: string, paymentMethod: PaymentMethod, paidById: string) {
    const award = await this.getAwardOrThrow(id);
    if (award.status !== AwardStatus.pending && award.status !== AwardStatus.approved) {
      throw new ConflictException('Solo se puede pagar un premio pendiente o aprobado');
    }
    return this.prisma.award.update({
      where: { id },
      data: { status: AwardStatus.paid, paymentMethod, paidAt: new Date(), paidById },
    });
  }

  private async getAwardOrThrow(id: string) {
    const award = await this.prisma.award.findUnique({ where: { id } });
    if (!award) throw new NotFoundException('Premio no encontrado');
    return award;
  }
}
