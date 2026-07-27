import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { Reflector } from '@nestjs/core';

// Escribe un registro en audit_log tras acciones marcadas con @Audit(). No reemplaza
// la lógica transaccional propia de cada servicio (ver módulos sales/lotteries/results).
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap((result) => {
        void this.prisma.auditLog.create({
          data: {
            userId: user?.id ?? null,
            action: meta.action,
            entity: meta.entity,
            entityId: (result as any)?.id ?? null,
            after: result as any,
            ipAddress: request.ip,
          },
        });
      }),
    );
  }
}
