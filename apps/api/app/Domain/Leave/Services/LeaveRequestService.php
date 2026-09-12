<?php

declare(strict_types=1);

namespace App\Domain\Leave\Services;

use App\Domain\Leave\Events\LeaveRequestApproved;
use App\Domain\Leave\Events\LeaveRequestCancelled;
use App\Domain\Leave\Events\LeaveRequestRejected;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * LeaveRequestService — owns the transactional integrity of the leave
 * balance book (Part 15 §15.1).
 *
 * The LeaveRequest model handles the state machine and event dispatch;
 * this service owns the balance adjustments that must stay in lockstep
 * with status changes. Every method runs inside a single DB transaction.
 */
final class LeaveRequestService implements ShouldQueue
{
    public $queue = 'leave';

    public $tries = 3;

    public function approve(LeaveRequest $request, User $actor, ?string $comments = null): void
    {
        \DB::transaction(function () use ($request, $actor, $comments) {
            $request->transitionTo('approved', $actor, $comments);

            $balance = $this->getBalance($request->employee_id, $request->leave_type_id);
            $balance->decrement('available_days', (float) $request->days_requested);
            $balance->increment('used_days', (float) $request->days_requested);
            $balance->save();

            LeaveRequestApproved::dispatch(
                $request->tenant_id,
                $request->id,
                $request->employee_id,
                $request->leave_type_id,
                (int) $request->days_requested,
            );
        });
    }

    public function reject(LeaveRequest $request, User $actor, ?string $comments = null): void
    {
        \DB::transaction(function () use ($request, $actor, $comments) {
            $previous = $request->getOriginal('status');
            $request->transitionTo('rejected', $actor, $comments);

            LeaveRequestRejected::dispatch(
                $request->tenant_id,
                $request->id,
                $request->employee_id,
                $previous,
            );
        });
    }

    public function cancel(LeaveRequest $request, User $actor, ?string $comments = null): void
    {
        \DB::transaction(function () use ($request, $actor, $comments) {
            $previous = $request->getOriginal('status');
            $days = (int) $request->days_requested;

            $request->transitionTo('cancelled', $actor, $comments);

            if ($previous === 'approved') {
                $balance = $this->getBalance($request->employee_id, $request->leave_type_id);
                $balance->increment('available_days', (float) $days);
                $balance->decrement('used_days', (float) $days);
                $balance->save();
            }

            LeaveRequestCancelled::dispatch(
                $request->tenant_id,
                $request->id,
                $request->employee_id,
                $previous,
                $days,
            );
        });
    }

    public function submit(LeaveRequest $request): void
    {
        \DB::transaction(function () use ($request) {
            $balance = $this->getBalance($request->employee_id, $request->leave_type_id);
            $balance->increment('pending_days', (float) $request->days_requested);
            $balance->save();
        });
    }

    private function getBalance(string $employeeId, string $leaveTypeId): LeaveBalance
    {
        $year = now()->year;

        return LeaveBalance::withoutTenantScope()
            ->where('tenant_id', TenantContext::current())
            ->where('employee_id', $employeeId)
            ->where('leave_type_id', $leaveTypeId)
            ->where('year', $year)
            ->firstOrFail();
    }
}
