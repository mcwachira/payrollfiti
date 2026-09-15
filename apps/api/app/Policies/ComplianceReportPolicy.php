<?php

namespace App\Policies;

use App\Models\ComplianceReport;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ComplianceReportPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('compliance.view') || $user->can('payroll.manage');
    }

    public function view(User $user, ComplianceReport $report): bool
    {
        return $this->canAccessTenant($user, $report)
            && ($user->can('compliance.view') || $user->can('payroll.manage'));
    }

    public function create(User $user): bool
    {
        return $user->can('compliance.generate') || $user->can('payroll.manage');
    }

    public function generate(User $user, ComplianceReport $report): bool
    {
        return $this->canAccessTenant($user, $report)
            && ($user->can('compliance.generate') || $user->can('payroll.manage'));
    }

    protected function canAccessTenant(User $user, ComplianceReport $report): bool
    {
        return $report->tenant_id === $user->tenant_id;
    }
}
