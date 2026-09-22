<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * AttendanceRecord — present/absent/leave/holiday/partial per employee per day.
 *
 * Part 15 §15.3. One row per (employee, attendance_date) via a unique
 * constraint; status values are free-form today ('present', 'absent', 'leave',
 * 'holiday', 'partial') and become the proration inputs for hourly/daily-rate
 * employees downstream. For salaried employees the row stays informational,
 * matching the original's scope.
 */
class AttendanceRecord extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'employee_id',
        'attendance_policy_id',
        'attendance_date',
        'clocked_in_at',
        'clocked_out_at',
        'regular_hours',
        'overtime_hours',
        'status',
        'metadata',
    ];

    protected $casts = [
        'attendance_date' => 'date',
        'clocked_in_at' => 'datetime',
        'clocked_out_at' => 'datetime',
        'regular_hours' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function attendancePolicy(): BelongsTo
    {
        return $this->belongsTo(AttendancePolicy::class, 'attendance_policy_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
