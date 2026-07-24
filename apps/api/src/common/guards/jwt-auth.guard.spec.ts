import { describe, it, expect, jest } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({}) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('short-circuits to true for routes marked @Public(), without delegating to passport', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const superCanActivateSpy = jest.spyOn(
      Object.getPrototypeOf(Object.getPrototypeOf(guard)),
      'canActivate',
    );

    const result = guard.canActivate(makeContext());

    expect(result).toBe(true);
    expect(superCanActivateSpy).not.toHaveBeenCalled();
    superCanActivateSpy.mockRestore();
  });

  // The non-public branch delegates to the real passport AuthGuard('jwt-access'),
  // which requires a full passport strategy/request pipeline to exercise
  // meaningfully. Rather than build a fragile mock of passport internals,
  // that path is covered by the e2e auth tests instead.
});
