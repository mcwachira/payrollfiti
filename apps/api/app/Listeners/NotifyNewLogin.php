<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\NotificationTypes;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Auth\Events\Login;

/**
 * Part 14: flags a fresh sign-in. Deliberately runs synchronously (NOT queued)
 * because the dedupe key is the current request's session hash — queue workers
 * have no HTTP session to read. The session hash changes with each login, so a
 * genuinely new sign-in produces a notification while the row is still
 * entity-keyed (user_session) for traceability. Entity key = the session hash,
 * so a repeated login on the very same session is deduped while a genuinely
 * new device/session produces a notification.
 *
 * Note: this fires for the auth guard on every successful login AFTER
 * sanitized credentials pass; the 5/min rate limit + 2FA gate already sit in
 * AuthController ahead of it.
 */
final class NotifyNewLogin
{
    public function handle(Login $event): void
    {
        $user = $event->user;

        if (! $user instanceof User) {
            return;
        }

        TenantContext::set($user->tenant_id);

        try {
            $sessionHash = hash('sha256', request()->session()->getId());

            app(NotificationDispatcher::class)->notify(
                $user->tenant_id,
                $user->id,
                NotificationTypes::AUTH_LOGIN_NEW_DEVICE,
                [
                    'entity_type' => 'user_session',
                    'entity_id' => $sessionHash,
                ],
            );
        } finally {
            TenantContext::clear();
        }
    }
}
