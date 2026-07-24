import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuthenticatedRequestUser } from '../auth/types';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Best-effort catch-all: logs every mutating request generically. Services
 * that need a real before/after diff (e.g. payroll runs, salary changes)
 * call AuditService.record() directly with richer detail instead.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response: unknown) => {
        const user: AuthenticatedRequestUser | undefined = request.user;
        // The refresh-token strategy's validated user shape has no tenantId
        // (see JwtRefreshStrategy.validate), so skip those requests here
        // rather than let AuditService fail an insert on every refresh call.
        if (!user?.tenantId) return;

        const responseRecord = (response ?? {}) as Record<string, unknown>;
        const entityType =
          request.route?.path?.split('/').filter(Boolean)[0] ?? 'unknown';
        const entityId = responseRecord.id ?? request.params?.id ?? 'n/a';

        void this.auditService.record({
          tenantId: user.tenantId,
          actorId: user.id,
          action: `${method} ${request.route?.path ?? request.url}`,
          entityType,
          entityId: String(entityId),
          after: (response ?? null) as Prisma.InputJsonValue | null,
          ipAddress: request.ip,
        });
      }),
    );
  }
}
