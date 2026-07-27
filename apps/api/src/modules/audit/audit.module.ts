import { Module } from '@nestjs/common';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';

// Provee el AuditInterceptor usado globalmente en app.module.ts (APP_INTERCEPTOR).
@Module({
  providers: [AuditInterceptor],
  exports: [AuditInterceptor],
})
export class AuditModule {}
