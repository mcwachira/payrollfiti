<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Compliance\Events\ComplianceReportGenerated;
use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\NotificationTypes;
use App\Models\ComplianceReport;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 14: queued listener that notifies when a compliance report is ready.
 * Preferred recipient is the payroll run's initiator when present, otherwise
 * every active user of the tenant. Idempotent via the report entity key.
 */
final class NotifyComplianceReportReady implements ShouldQueue
{
    public $queue = 'notifications';

    public $tries = 3;

    public $timeout = 60;

    public function handle(ComplianceReportGenerated $event): void
    {
        TenantContext::set($event->tenantId);

        try {
            $report = ComplianceReport::withoutTenantScope()->find($event->reportId);

            if ($report === null) {
                return;
            }

            $recipients = $event->initiatedBy !== null
                ? [$event->initiatedBy]
                : User::withoutTenantScope()
                    ->where('tenant_id', $event->tenantId)
                    ->where('status', 'active')
                    ->pluck('id')
                    ->all();

            if ($recipients === []) {
                return;
            }

            app(NotificationDispatcher::class)->notify(
                $event->tenantId,
                $recipients,
                NotificationTypes::COMPLIANCE_REPORT_READY,
                [
                    'report_id' => $report->id,
                    'report_code' => $report->report_code,
                    'country' => $report->country,
                    'entity_type' => 'compliance_report',
                    'entity_id' => $report->id,
                ],
            );
        } finally {
            TenantContext::clear();
        }
    }
}
