'use client';

import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';

// Unlike /settings (ADMIN-only tenant configuration), this page is personal
// account security — every role gets here, so it isn't wrapped in a
// RoleGuard/RoleRedirectGuard. AuthGuard on the (app) layout already
// requires a logged-in user, which is all this page needs.
export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Account</h1>
        <p className="text-muted-foreground">Manage your own login security</p>
      </div>

      <TwoFactorSettings />
    </div>
  );
}
