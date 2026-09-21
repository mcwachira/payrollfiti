<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * LeaveBalance — the per-employee, per-leave-type, per-year balance ledger.
 *
 * Part 15 §15.1. `available_days` is a materialised column
 * (allocated + carried_forward - used - pending) kept in sync by the leave
 * workflow listeners; it is derivable, but storing it keeps reads trivial and
 * gives the API a single authoritative value.
 */
class LeaveBalance extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'employee_id',
        'leave_type_id',
        'year',
        'allocated_days',
        'carried_forward_days',
        'used_days',
        'pending_days',
        'available_days',
    ];

    protected $casts = [
        'allocated_days' => 'decimal:2',
        'carried_forward_days' => 'decimal:2',
        'used_days' => 'decimal:2',
        'pending_days' => 'decimal:2',
        'available_days' => 'decimal:2',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }

    public function accruals(): HasMany
    {
        return $this->hasMany(LeaveAccrual::class, 'leave_balance_id');
    }
}
