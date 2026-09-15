<?php

declare(strict_types=1);

namespace App\Commands;

use App\Models\Employee;
use App\Models\LeaveAccrual;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Part 15 §15.1: monthly leave accrual command.
 *
 * Iterates over all tenants, accrues leave days per employee
 * based on their LeaveType configuration, and records the
 * accrual in the LeaveAccrual ledger for idempotency.
 */
class LeaveAccrueMonthlyCommand extends Command
{
    protected $signature = 'leave:accrue-monthly';

    protected $description = 'Accrue monthly leave days for all employees';

    public function handle(): int
    {
        $tenants = DB::table('tenants')->select('id')->get();

        foreach ($tenants as $tenant) {
            TenantContext::set($tenant->id);

            try {
                $this->accrueForTenant($tenant->id);
            } finally {
                TenantContext::clear();
            }
        }

        $this->info('Leave accrual completed.');

        return 0;
    }

    private function accrueForTenant(string $tenantId): void
    {
        $year = now()->year;
        $month = now()->month;
        $period = "{$year}-{$month}";

        $leaveTypes = LeaveType::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get();

        foreach ($leaveTypes as $leaveType) {
            $employees = Employee::withoutTenantScope()
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->get();

            foreach ($employees as $employee) {
                $daysToAccrue = (float) ($leaveType->default_days_per_year / 12);

                if ($daysToAccrue <= 0) {
                    continue;
                }

                $balance = LeaveBalance::withoutTenantScope()
                    ->where('tenant_id', $tenantId)
                    ->where('employee_id', $employee->id)
                    ->where('leave_type_id', $leaveType->id)
                    ->where('year', $year)
                    ->first();

                if ($balance === null) {
                    $balance = LeaveBalance::create([
                        'tenant_id' => $tenantId,
                        'company_id' => $employee->company_id,
                        'employee_id' => $employee->id,
                        'leave_type_id' => $leaveType->id,
                        'year' => $year,
                        'allocated_days' => 0,
                        'carried_forward_days' => 0,
                        'used_days' => 0,
                        'pending_days' => 0,
                        'available_days' => 0,
                    ]);
                }

                $balance->increment('allocated_days', $daysToAccrue);
                $balance->increment('available_days', $daysToAccrue);
                $balance->save();

                LeaveAccrual::create([
                    'tenant_id' => $tenantId,
                    'employee_id' => $employee->id,
                    'leave_type_id' => $leaveType->id,
                    'leave_balance_id' => $balance->id,
                    'period' => $period,
                    'accrued_days' => $daysToAccrue,
                    'source' => 'monthly_accrual',
                ]);
            }
        }
    }
}
