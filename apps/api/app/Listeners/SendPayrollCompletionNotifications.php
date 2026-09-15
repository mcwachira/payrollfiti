<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\NotificationTypes;
use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Models\PayrollRun;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 13 §13.5 + Part 14: queued listener that turns a completed payroll run
 * into a notification for the user who initiated it. Runs on the `notifications`
 * queue. The heavy lifting (preferences, templates, channels, dedupe) lives in
 * NotificationDispatcher — this listener only extracts candidates.
 *
 * Idempotency now relies on the dispatcher's entity-keyed dedupe_hash
 * (tenant|user|event|payroll_run), so a retried payload can never create a
 * second bell entry.
 */
final class SendPayrollCompletionNotifications implements ShouldQueue
{
    public $queue = 'notifications';

    public $tries = 3;

    public $timeout = 60;

    public function handle(PayrollRunCompleted $event): void
    {
        TenantContext::set($event->tenantId);

        try {
            /** @var PayrollRun|null $run */
            $run = PayrollRun::withoutTenantScope()->find($event->payrollRunId);

            if ($run === null || $run->initiated_by === null) {
                return;
            }

            $run->loadMissing('company');

            app(NotificationDispatcher::class)->notify(
                $event->tenantId,
                $run->initiated_by,
                NotificationTypes::PAYROLL_RUN_COMPLETED,
                [
                    'run_id' => $run->id,
                    'company' => $run->company?->name,
                    'entity_type' => 'payroll_run',
                    'entity_id' => $run->id,
                ],
            );
        } finally {
            TenantContext::clear();
        }
    }
}
