<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Notification;
use App\Models\User;

/**
 * Ownership gate for notifications. Combined with the user-scoped route model
 * binding in AppServiceProvider, cross-tenant and cross-user reads already
 * resolve to 404; this policy is the defence-in-depth that would also block a
 * direct-bind bypass.
 */
class NotificationPolicy
{
    public function viewAny(?User $user): bool
    {
        return $user !== null;
    }

    public function view(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id
            && $user->tenant_id === $notification->tenant_id;
    }

    public function update(User $user, Notification $notification): bool
    {
        return $this->view($user, $notification);
    }
}
