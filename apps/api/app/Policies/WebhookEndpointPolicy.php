<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\WebhookEndpoint;
use Illuminate\Auth\Access\HandlesAuthorization;

class WebhookEndpointPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && $user->can('webhooks.view');
    }

    public function view(User $user, WebhookEndpoint $webhookEndpoint): bool
    {
        return $user->tenant_id === $webhookEndpoint->tenant_id && $user->can('webhooks.view');
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && $user->can('webhooks.manage');
    }

    public function update(User $user, WebhookEndpoint $webhookEndpoint): bool
    {
        return $user->tenant_id === $webhookEndpoint->tenant_id && $user->can('webhooks.manage');
    }

    public function delete(User $user, WebhookEndpoint $webhookEndpoint): bool
    {
        return $user->tenant_id === $webhookEndpoint->tenant_id && $user->can('webhooks.manage');
    }
}
