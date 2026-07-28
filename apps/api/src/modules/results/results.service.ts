import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AwardStatus } from '@prisma/client';
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
}
