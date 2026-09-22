<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * LeaveType — a company's leave category (Annual, Sick, Maternity, ...).
 *
 * Part 15 §15.1. Company-scoped configuration that drives the LeaveRequest
 * workflow and the monthly accrual command (default_days_per_year,
 * accrual_type). BelongsToTenant applies the global TenantScope so queries are
 * isolated structurally, and RLS is the second line of defense.
 */
class LeaveType extends Model
{
    use BelongsToTenant, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'description',
        'default_days_per_year',
        'accrual_type',
        'approval_type',
        'is_paid',
        'allow_carry_forward',
        'maximum_carry_forward_days',
        'requires_document',
        'is_active',
        'rules',
    ];

    protected $casts = [
        'default_days_per_year' => 'decimal:2',
        'maximum_carry_forward_days' => 'decimal:2',
        'is_paid' => 'boolean',
        'allow_carry_forward' => 'boolean',
        'requires_document' => 'boolean',
        'is_active' => 'boolean',
        'rules' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function balances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class, 'leave_type_id');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class, 'leave_type_id');
    }
}
