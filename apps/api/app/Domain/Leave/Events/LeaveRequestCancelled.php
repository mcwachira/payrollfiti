<?php

declare(strict_types=1);

namespace App\Domain\Leave\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted when a leave request transitions to cancelled (Part 15 §15.1).
 *
 * If cancelled before the leave period starts, the balance is restored.
 */
final class LeaveRequestCancelled
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $tenantId,
        public string $leaveRequestId,
        public string $employeeId,
        public string $previousStatus,
        public int $daysRequested,
    ) {}
}
