<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * AttendancePolicy — the shift/schedule configuration a company applies to an
 * AttendanceRecord (Part 15 §15.3).
 *
 * `schedule` is a JSONB map (e.g. {"monday": {"start": "08:00", "end": "17:00"}})
 * used by the clock-in/clock-out service to compare planned vs worked hours,
 * not a hard payroll input for salaried employees.
 */
class AttendancePolicy extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'name',
        'timezone',
        'schedule',
        'grace_minutes',
        'active',
    ];

    protected $casts = [
        'schedule' => 'array',
        'active' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function records(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'attendance_policy_id');
    }
}
