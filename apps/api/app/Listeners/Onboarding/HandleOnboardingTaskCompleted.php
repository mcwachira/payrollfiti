<?php

declare(strict_types=1);

namespace App\Listeners\Onboarding;

use App\Domain\Onboarding\Events\OnboardingTaskCompleted;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 16 §16.1: onboarding task event listener.
 *
 * Handles post-completion side effects like notifications and audit logging.
 */
final class HandleOnboardingTaskCompleted implements ShouldQueue
{
    public $queue = 'onboarding';

    public $tries = 3;

    public function handle(OnboardingTaskCompleted $event): void
    {
        TenantContext::set($event->tenantId);
    }
}
