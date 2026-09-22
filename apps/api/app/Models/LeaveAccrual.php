<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * LeaveAccrual — one row per successful monthly accrual (the idempotency
 * ledger behind `leave:accrue-monthly`, Part 15 §15.1).
 *
 * The unique (employee_id, leave_type_id, period) constraint means a scheduler
 * double-fire cannot accrue the same month twice: the second insert fails the
 * unique index and is ignored, so the command is safe to run daily.
 */
class LeaveAccrual extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [

        'employee_id',
        'leave_type_id',
        'leave_balance_id',
        'period',
        'accrued_days',
        'source',
        'meta',
    ];

    protected $casts = [
        'accrued_days' => 'decimal:2',
        'meta' => 'array',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }

    public function leaveBalance(): BelongsTo
    {
        return $this->belongsTo(LeaveBalance::class, 'leave_balance_id');
    }
}
