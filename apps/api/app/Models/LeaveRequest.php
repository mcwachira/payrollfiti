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
 * LeaveRequest — a single leave application with an explicit approval state
 * machine (Part 15 §15.1).
 *
 * Transitions are enforced through transitionTo() — never a bare
 * status update — mirroring the PaymentTransaction state machine (§12.4):
 *   pending  → approved | rejected | cancelled
 *   approved → cancelled  (only within the grace window: before the requested
 *                          leave period starts, so unused days are returned)
 *   rejected → (terminal)
 *
 * Side effects that must stay in lockstep with a status change (balance
 * adjustments, approval records) are fired from here as domain events; the
 * transactional integrity of the balance book is owned by the LeaveRequestService.
 */
class LeaveRequest extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'company_id',
        'employee_id',
        'leave_type_id',
        'submitted_by',
        'start_date',
        'end_date',
        'days_requested',
        'reason',
        'status',
        'cancelled_at',
        'approved_at',
    ];

    /** Statuses that no further transition is possible from. */
    private const TERMINAL_STATUSES = ['rejected'];

    /** Target status => the only source statuses that may reach it. */
    private const ALLOWED_TRANSITIONS = [
        'approved' => ['pending'],
        'rejected' => ['pending'],
        'cancelled' => ['pending', 'approved'],
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'days_requested' => 'decimal:2',
        'approved_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(LeaveApproval::class, 'leave_request_id');
    }

    public function canCancel(): bool
    {
        $today = now()->toDateString();

        return $this->start_date !== null && $this->start_date->toDateString() > $today;
    }

    /**
     * Transition this request through the leave state machine.
     *
     * Rejects illegal transitions (e.g. approved → rejected), records the
     * approval/decision row, and dispatches the matching domain event. When the
     * event publisher was handed an actor (the deciding user), their decision
     * is written into leave_approvals inside this transaction.
     */
    public function transitionTo(string $to, ?User $actor = null, ?string $comments = null): bool
    {
        if ($this->status === $to) {
            return true;
        }

        $allowed = self::ALLOWED_TRANSITIONS[$to] ?? [];

        if (! in_array($this->status, $allowed, true)) {
            throw new InvalidArgumentException(
                "Cannot transition leave request from [{$this->status}] to [{$to}]."
            );
        }

        if ($to === 'cancelled' && ! $this->canCancel()) {
            throw new InvalidArgumentException(
                'A leave request cannot be cancelled once the leave period has started.'
            );
        }

        $this->status = $to;

        if ($to === 'approved') {
            $this->approved_at = now();
        }

        if ($to === 'cancelled') {
            $this->cancelled_at = now();
        }

        $this->save();

        if ($actor !== null && in_array($to, ['approved', 'rejected'], true)) {
            $this->approvals()->create([
                'tenant_id' => $this->tenant_id,
                'approver_id' => $actor->id,
                'status' => $to,
                'comments' => $comments,
                'decided_at' => now(),
            ]);
        }

        return true;
    }
}
