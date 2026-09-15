<?php

declare(strict_types=1);

namespace App\Domain\Onboarding\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when an onboarding task is completed (Part 16 §16.1).
 */
class OnboardingTaskCompleted
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $taskId,
        public readonly string $employeeId,
        public readonly string $companyId,
    ) {}
}
