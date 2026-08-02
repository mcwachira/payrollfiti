import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';

/**
 * Registered globally in AppModule. Runs after the auth guards (so
 * request.user is already populated by JwtAuthGuard or ApiKeyGuard) and
 * establishes the AsyncLocalStorage tenant context for the rest of the
 * request — including everything the controller handler awaits — so
 * PrismaService's tenant-scoping extension can enforce isolation without
 * every call site threading tenantId through manually.
 *
 * `next.handle()` returns a cold Observable: nothing runs until something
 * subscribes to it, and that subscription normally happens outside this
 * method (in Nest's own pipeline), by which point `TenantContext.run`'s
 * synchronous callback would already have returned and torn the context
 * back down — leaving the controller/service code to run with no tenant
 * context at all. Subscribing to `next.handle()` ourselves, synchronously
 * inside the `run` callback, is what actually starts the request pipeline
 * while the context is still active (the same pattern used by
 * nestjs-cls's interceptor for the same reason).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;
    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      TenantContext.run({ tenantId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
