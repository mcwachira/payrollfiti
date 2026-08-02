import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_SUBSCRIPTION_KEY = 'allowWithoutSubscription';

/**
 * Exempts a route (or every route on a controller) from SubscriptionGuard.
 * Applied to BillingController — a tenant whose trial has expired or whose
 * subscription lapsed must still be able to view invoices and pay to
 * reactivate — and to TenantsController, since seeing/creating a Company is
 * a prerequisite to having anything to bill in the first place.
 */
export const AllowWithoutSubscription = () =>
  SetMetadata(ALLOW_WITHOUT_SUBSCRIPTION_KEY, true);
