<?php

namespace App\Policies;

use App\Models\Loan;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class LoanPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('loans.view') || $user->can('loans.manage'));
    }

    public function view(User $user, Loan $loan): bool
    {
        return $user->tenant_id === $loan->tenant_id && ($user->can('loans.view') || $user->can('loans.manage'));
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('loans.create') || $user->can('loans.manage'));
    }

    public function update(User $user, Loan $loan): bool
    {
        return $user->tenant_id === $loan->tenant_id && ($user->can('loans.approve') || $user->can('loans.manage'));
    }
}
