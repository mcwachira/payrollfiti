<?php

namespace App\Policies;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class LeaveRequestPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('leave.view') || $user->can('leave.manage'));
    }

    public function view(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->tenant_id === $leaveRequest->tenant_id && ($user->can('leave.view') || $user->can('leave.manage'));
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('leave.create') || $user->can('leave.manage'));
    }

    public function update(User $user, LeaveRequest $leaveRequest): bool
    {
        return $user->tenant_id === $leaveRequest->tenant_id && ($user->can('leave.approve') || $user->can('leave.manage'));
    }
}
