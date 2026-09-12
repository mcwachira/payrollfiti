<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ApiKey;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ApiKeyPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && $user->can('api-keys.view');
    }

    public function view(User $user, ApiKey $apiKey): bool
    {
        return $user->tenant_id === $apiKey->tenant_id && $user->can('api-keys.view');
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && $user->can('api-keys.manage');
    }

    public function update(User $user, ApiKey $apiKey): bool
    {
        return $user->tenant_id === $apiKey->tenant_id && $user->can('api-keys.manage');
    }

    public function delete(User $user, ApiKey $apiKey): bool
    {
        return $user->tenant_id === $apiKey->tenant_id && $user->can('api-keys.manage');
    }
}
