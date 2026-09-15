<?php

declare(strict_types=1);

namespace App\Domain\Attendance\Services;

use App\Models\AttendancePolicy;
use App\Models\AttendanceRecord;
use App\Models\PublicHoliday;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * AttendanceService — manages attendance records and policy enforcement
 * (Part 15 §15.3).
 *
 * Provides methods for clocking in/out, marking holidays, and generating
 * daily attendance summaries.
 */
final class AttendanceService
{
    public function clockIn(string $employeeId, string $policyId, array $data): AttendanceRecord
    {
        $tenantId = TenantContext::current();
        $attendanceDate = Carbon::parse($data['attendance_date'] ?? now()->toDateString());

        $existing = AttendanceRecord::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('attendance_date', $attendanceDate->toDateString())
            ->first();

        if ($existing) {
            throw new \RuntimeException('Attendance record already exists for this date.');
        }

        return AttendanceRecord::create([
            'tenant_id' => $tenantId,
            'company_id' => $data['company_id'],
            'employee_id' => $employeeId,
            'attendance_policy_id' => $policyId,
            'attendance_date' => $attendanceDate->toDateString(),
            'clocked_in_at' => now(),
            'status' => 'present',
            'metadata' => $data['metadata'] ?? [],
        ]);
    }

    public function clockOut(string $recordId, array $data): AttendanceRecord
    {
        $record = AttendanceRecord::withoutTenantScope()
            ->where('id', $recordId)
            ->firstOrFail();

        $record->clocked_out_at = now();
        $record->regular_hours = $data['regular_hours'] ?? $this->calculateRegularHours($record);
        $record->overtime_hours = $data['overtime_hours'] ?? $this->calculateOvertimeHours($record);
        $record->status = $data['status'] ?? 'present';
        $record->metadata = $data['metadata'] ?? $record->metadata;
        $record->save();

        return $record;
    }

    public function markHoliday(string $employeeId, string $attendanceDate, array $data): AttendanceRecord
    {
        $tenantId = TenantContext::current();

        return AttendanceRecord::create([
            'tenant_id' => $tenantId,
            'company_id' => $data['company_id'],
            'employee_id' => $employeeId,
            'attendance_policy_id' => $data['attendance_policy_id'],
            'attendance_date' => $attendanceDate,
            'status' => 'holiday',
            'metadata' => $data['metadata'] ?? [],
        ]);
    }

    public function markAbsent(string $employeeId, string $attendanceDate, array $data): AttendanceRecord
    {
        $tenantId = TenantContext::current();

        return AttendanceRecord::create([
            'tenant_id' => $tenantId,
            'company_id' => $data['company_id'],
            'employee_id' => $employeeId,
            'attendance_policy_id' => $data['attendance_policy_id'],
            'attendance_date' => $attendanceDate,
            'status' => 'absent',
            'metadata' => $data['metadata'] ?? [],
        ]);
    }

    public function getMonthlySummary(string $employeeId, string $yearMonth): Collection
    {
        return AttendanceRecord::withoutTenantScope()
            ->where('tenant_id', TenantContext::current())
            ->where('employee_id', $employeeId)
            ->where('attendance_date', 'like', "$yearMonth%")
            ->orderBy('attendance_date')
            ->get();
    }

    public function isHoliday(string $attendanceDate, ?string $companyId = null): bool
    {
        $query = PublicHoliday::withoutTenantScope()
            ->where('holiday_date', $attendanceDate);

        if ($companyId) {
            $query->where(function ($q) use ($companyId) {
                $q->where('company_id', $companyId)->orWhereNull('company_id');
            });
        }

        return $query->exists();
    }

    private function calculateRegularHours(AttendanceRecord $record): float
    {
        if (! $record->clocked_in_at || ! $record->clocked_out_at) {
            return 0.0;
        }

        return round($record->clocked_in_at->diffInHours($record->clocked_out_at), 2);
    }

    private function calculateOvertimeHours(AttendanceRecord $record): float
    {
        $regularHours = $this->calculateRegularHours($record);
        $policy = AttendancePolicy::withoutTenantScope()
            ->where('id', $record->attendance_policy_id)
            ->first();

        $dailyHours = $policy ? ($policy->schedule ? 8.0 : 8.0) : 8.0;

        return max(0.0, round($regularHours - $dailyHours, 2));
    }
}
