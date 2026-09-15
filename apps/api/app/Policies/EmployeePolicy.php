<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class EmployeePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('employees.view') || $user->can('payroll.manage'));
    }

    public function view(User $user, Employee $employee): bool
    {
        return $user->tenant_id === $employee->tenant_id && ($user->can('employees.view') || $user->can('payroll.manage'));
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null && ($user->can('employees.manage') || $user->can('employees.create'));
    }

    public function update(User $user, Employee $employee): bool
    {
        return $user->tenant_id === $employee->tenant_id && ($user->can('employees.manage') || $user->can('employees.update'));
    }

    public function delete(User $user, Employee $employee): bool
    {
        return $user->tenant_id === $employee->tenant_id && ($user->can('employees.manage') || $user->can('employees.delete'));
    }
}
