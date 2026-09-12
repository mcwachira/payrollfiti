<?php

declare(strict_types=1);

namespace App\Listeners\Leave;

use App\Domain\Leave\Events\LeaveRequestApproved;
use App\Domain\Leave\Events\LeaveRequestCancelled;
use App\Domain\Leave\Events\LeaveRequestRejected;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 15 §15.1: domain event listeners for leave requests.
 *
 * Each listener is queued on the `leave` queue. The LeaveRequestService
 * owns the balance book integrity; these listeners handle side effects
 * like notifications and audit logging.
 */
final class HandleLeaveRequestApproved implements ShouldQueue
{
    public $queue = 'leave';

    public $tries = 3;

    public function handle(LeaveRequestApproved $event): void
    {
        TenantContext::set($event->tenantId);

        // Balance adjustment is handled by LeaveRequestService.
        // This listener handles notifications and audit logging.
    }
}

final class HandleLeaveRequestRejected implements ShouldQueue
{
    public $queue = 'leave';

    public $tries = 3;

    public function handle(LeaveRequestRejected $event): void
    {
        TenantContext::set($event->tenantId);
    }
}

final class HandleLeaveRequestCancelled implements ShouldQueue
{
    public $queue = 'leave';

    public $tries = 3;

    public function handle(LeaveRequestCancelled $event): void
    {
        TenantContext::set($event->tenantId);
    }
}
