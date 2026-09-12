<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\AccountingConnection;
use App\Models\Company;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class AccountingConnectionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && $user->can('accounting.view');
    }

    public function view(User $user, AccountingConnection $accountingConnection): bool
    {
        return $user->tenant_id === $accountingConnection->tenant_id && $user->can('accounting.view');
    }

    public function create(User $user, Company $company): bool
    {
        return $user->tenant_id === $company->tenant_id && $user->can('accounting.manage');
    }

    public function update(User $user, AccountingConnection $accountingConnection): bool
    {
        return $user->tenant_id === $accountingConnection->tenant_id && $user->can('accounting.manage');
    }

    public function delete(User $user, AccountingConnection $accountingConnection): bool
    {
        return $user->tenant_id === $accountingConnection->tenant_id && $user->can('accounting.manage');
    }
}
