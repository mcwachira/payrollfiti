<?php

declare(strict_types=1);

namespace App\Domain\Leave\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted when a leave request transitions to approved (Part 15 §15.1).
 *
 * Listeners adjust the employee's leave balance and create the approval record.
 */
final class LeaveRequestApproved
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $tenantId,
        public string $leaveRequestId,
        public string $employeeId,
        public string $leaveTypeId,
        public int $daysRequested,
    ) {}
}
