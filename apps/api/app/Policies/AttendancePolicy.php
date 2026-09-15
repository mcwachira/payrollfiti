<?php

namespace App\Policies;

use App\Models\AttendanceRecord;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class AttendancePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('attendance.view') || $user->can('attendance.manage'));
    }

    public function view(User $user, AttendanceRecord $record): bool
    {
        return $user->tenant_id === $record->tenant_id && ($user->can('attendance.view') || $user->can('attendance.manage'));
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('attendance.create') || $user->can('attendance.manage'));
    }

    public function update(User $user, AttendanceRecord $record): bool
    {
        return $user->tenant_id === $record->tenant_id && ($user->can('attendance.manage'));
    }
}
