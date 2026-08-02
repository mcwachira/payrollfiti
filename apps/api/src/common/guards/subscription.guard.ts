import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_WITHOUT_SUBSCRIPTION_KEY } from '../decorators/allow-without-subscription.decorator';
import { AuthenticatedRequestUser } from '../../auth/types';

/**
 * Registered globally, after JwtAuthGuard. Blocks a tenant whose trial has
 * expired or whose subscription has lapsed (PAST_DUE/CANCELED) from using
 * the product, while always leaving a path back to paying.
 *
 * Deliberately fails OPEN when a tenant has no Subscription row at all,
 * rather than closed: every tenant created before this guard shipped has no
 * Subscription (BillingService.subscribe() was previously the only thing
 * that ever created one), and failing closed here would retroactively lock
 * out every existing account rather than just enforce the trial going
 * forward. New signups always get a TRIALING subscription from
 * BillingService.startTrial(), so this only actually matters for genuinely
 * new tenants and for anyone whose trial/subscription has run out.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isExempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isExempt) return true;

    const request = context.switchToHttp().getRequest();
    // The public read-only API has its own access model (a scoped API key,
    // not a tenant seat) — never subject to seat-based trial/paywall logic.
    if (request.isApiKeyAuth) return true;

    const user: AuthenticatedRequestUser | undefined = request.user;
    if (!user) return true; // no authenticated user — nothing to check, some other guard already handles this

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (!subscription) return true; // see class doc — fail open for un-migrated tenants

    const trialExpired =
      subscription.status === SubscriptionStatus.TRIALING &&
      subscription.currentPeriodEnd.getTime() < Date.now();
    const lapsed =
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.CANCELED;

    if (trialExpired || lapsed) {
      throw new ForbiddenException(
        trialExpired
          ? 'Your trial has ended. Choose a plan in Billing to keep using PayrollFiti.'
          : 'Your subscription is not active. Reactivate it in Billing to continue.',
      );
    }
    return true;
  }
}
