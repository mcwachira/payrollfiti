import { describe, it, expect } from '@jest/globals';
import { JwtRefreshGuard } from './jwt-refresh.guard';

describe('JwtRefreshGuard', () => {
  // This guard has no custom logic of its own — it's a thin passport
  // AuthGuard('jwt-refresh') subclass. Its real behavior (validating the
  // refresh token against the jwt-refresh strategy) is covered by the e2e
  // auth tests; this is just a smoke test that it constructs cleanly.
  it('constructs without throwing', () => {
    expect(() => new JwtRefreshGuard()).not.toThrow();
  });
});
