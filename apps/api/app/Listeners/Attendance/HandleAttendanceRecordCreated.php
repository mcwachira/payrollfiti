<?php

declare(strict_types=1);

namespace App\Listeners\Attendance;

use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 15 §15.3: attendance event listener.
 *
 * Handles post-attendance side effects like notifications.
 */
final class HandleAttendanceRecordCreated implements ShouldQueue
{
    public $queue = 'attendance';

    public $tries = 3;

    public function handle(array $event): void
    {
        TenantContext::set($event['tenantId']);
    }
}
