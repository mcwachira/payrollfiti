import { defer, of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContext } from './tenant-context';

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('TenantContextInterceptor', () => {
  it('establishes the tenant context around the rest of the request', (done) => {
    const interceptor = new TenantContextInterceptor();
    const handler: CallHandler = {
      handle: () => {
        expect(TenantContext.getTenantId()).toBe('tenant-1');
        return of('ok');
      },
    };

    interceptor
      .intercept(contextWithUser({ tenantId: 'tenant-1' }), handler)
      .subscribe((value) => {
        expect(value).toBe('ok');
        done();
      });
  });

  it('does not set a tenant context when there is no authenticated user', (done) => {
    const interceptor = new TenantContextInterceptor();
    const handler: CallHandler = {
      handle: () => {
        expect(TenantContext.getTenantId()).toBeUndefined();
        return of('ok');
      },
    };

    interceptor.intercept(contextWithUser(undefined), handler).subscribe(() => {
      done();
    });
  });

  it('does not leak tenant context to code outside the subscription', () => {
    const interceptor = new TenantContextInterceptor();
    const outerHandler: CallHandler = {
      handle: () => of('outer'),
    };
    // of('outer') emits and completes synchronously, so by the time this
    // .subscribe() call returns, TenantContext.run's callback (and its
    // internal subscribe) has already finished and restored the outer
    // (unset) context — this is what a caller further up the stack, after
    // the request has been handled, would observe.
    let received: string | undefined;
    interceptor
      .intercept(contextWithUser({ tenantId: 'tenant-1' }), outerHandler)
      .subscribe((value) => {
        received = value as string;
      });

    expect(received).toBe('outer');
    expect(TenantContext.getTenantId()).toBeUndefined();
  });

  it('keeps the context active when the handler is lazy — nothing runs until it is subscribed to (regression test)', (done) => {
    // A naive `return TenantContext.run({tenantId}, () => next.handle())`
    // (no internal subscribe) tears the ALS context down as soon as
    // next.handle() returns, which happens before Nest's own pipeline ever
    // subscribes to it — so a handler that defers its work until
    // subscription (as real route handlers effectively do once you factor
    // in Prisma's lazy thenables) would see no tenant context at all. This
    // is exactly the bug the manual-subscribe implementation fixes.
    const interceptor = new TenantContextInterceptor();
    let tenantIdSeenInsideHandler: string | undefined;
    const lazyHandler: CallHandler = {
      handle: () =>
        defer(() => {
          tenantIdSeenInsideHandler = TenantContext.getTenantId();
          return of('lazy-result');
        }),
    };

    interceptor
      .intercept(contextWithUser({ tenantId: 'tenant-1' }), lazyHandler)
      .subscribe((value) => {
        expect(value).toBe('lazy-result');
        expect(tenantIdSeenInsideHandler).toBe('tenant-1');
        done();
      });
  });
});
