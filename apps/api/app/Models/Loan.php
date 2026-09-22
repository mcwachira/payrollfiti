<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

/**
 * Loan — an employee advance whose repayment schedule is an immutable plan.
 *
 * Part 15 §15.2. Approving a loan (`transitionTo('active', ...)`) never
 * recalculates the schedule in place: the LoanApproved event materialises the
 * loan_repayments rows exactly once, and each period's payroll run feeds the
 * scheduled installment into the payroll engine as a voluntaryDeduction
 * (§9.6) — the engine remains the single source of truth for anything that
 * touches net pay.
 */
class Loan extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'employee_id',
        'loan_product_id',
        'approved_by',
        'principal_amount',
        'interest_amount',
        'total_amount',
        'outstanding_amount',
        'term_months',
        'start_date',
        'end_date',
        'status',
        'approved_at',
        'approval_notes',
    ];

    /** End states that no further loan workflow transition is possible from. */
    private const TERMINAL_STATUSES = ['rejected', 'completed'];

    /** Target status => source statuses that may reach it. */
    private const ALLOWED_TRANSITIONS = [
        'active' => ['pending'],
        'rejected' => ['pending'],
        'completed' => ['active'],
    ];

    protected $casts = [
        'principal_amount' => 'decimal:2',
        'interest_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'outstanding_amount' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'approved_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function loanProduct(): BelongsTo
    {
        return $this->belongsTo(LoanProduct::class, 'loan_product_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function repayments(): HasMany
    {
        return $this->hasMany(LoanRepayment::class, 'loan_id');
    }

    /**
     * Transition this loan through its lifecycle via the state machine, never
     * a bare status update. Approving sets approval metadata and dispatches
     * LoanApproved, whose listener materialises the immutable repayment
     * schedule.
     */
    public function transitionTo(string $to, ?User $actor = null, ?string $notes = null): bool
    {
        if ($this->status === $to) {
            return true;
        }

        $allowed = self::ALLOWED_TRANSITIONS[$to] ?? [];

        if (! in_array($this->status, $allowed, true)) {
            throw new InvalidArgumentException(
                "Cannot transition loan from [{$this->status}] to [{$to}]."
            );
        }

        $this->status = $to;

        if ($to === 'active') {
            $this->approved_by = $actor?->id;
            $this->approved_at = now();
            $this->approval_notes = $notes;

            if ($this->start_date === null && $this->term_months > 0) {
                $start = now()->startOfDay();
                $this->start_date = $start->toDateString();
                $this->end_date = $start->addMonths($this->term_months)->subDay()->toDateString();
            }
        }

        $this->save();

        return true;
    }
}
