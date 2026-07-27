import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: string;
  entity: string;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
