<?php

namespace App\Policies;

use App\Models\Company;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PayrollRunPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null && $user->can('payroll.view');
    }

    public function view(User $user, PayrollRun $payrollRun): bool
    {
        return $this->canAccessTenant($user, $payrollRun)
            && ($user->can('payroll.view') || $user->can('payroll.manage'));
    }

    public function run(User $user, $company): bool
    {
        if ($company instanceof PayrollRun) {
            return $this->canAccessTenant($user, $company) && $user->can('payroll.manage');
        }

        return $user->tenant_id !== null
            && $company instanceof Company
            && $user->tenant_id === $company->tenant_id
            && $user->can('payroll.manage');
    }

    public function approve(User $user, PayrollRun $payrollRun): bool
    {
        return $this->canAccessTenant($user, $payrollRun)
            && $user->can('payroll.manage')
            && $payrollRun->initiated_by !== $user->id;
    }

    public function finalize(User $user, PayrollRun $payrollRun): bool
    {
        return $this->canAccessTenant($user, $payrollRun)
            && $user->can('payroll.manage')
            && $payrollRun->status === 'approved';
    }

    protected function canAccessTenant(User $user, PayrollRun $payrollRun): bool
    {
        if (! $user->tenant_id || ! $payrollRun->tenant_id) {
            return false;
        }

        return $user->tenant_id === $payrollRun->tenant_id;
    }
}
