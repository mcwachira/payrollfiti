import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Reports every unhandled exception to Sentry (a no-op if SENTRY_DSN isn't
 * set — Sentry.captureException is safe to call whether or not Sentry.init
 * ran in main.ts), then delegates to Nest's default HTTP exception
 * handling so the response shape is unchanged.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    Sentry.captureException(exception);
    super.catch(exception, host);
  }
}
