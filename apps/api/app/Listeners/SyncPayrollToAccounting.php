<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Jobs\SyncAccountingConnection;
use App\Models\AccountingConnection;
use App\Models\PayrollRun;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 13 §13.5: queued listener that syncs a completed payroll run into the
 * tenant's external accounting platform(s) via the `integrations` queue.
 *
 * The listener itself does nothing but dispatch ONE SyncAccountingConnection
 * job per active connection: the heavy lifting (idempotent sync records,
 * provider payload construction) lives in the job so each connection is
 * independent and retryable.
 */
final class SyncPayrollToAccounting implements ShouldQueue
{
    public $queue = 'integrations';

    public $tries = 3;

    public $timeout = 240;

    public function handle(PayrollRunCompleted $event): void
    {
        TenantContext::set($event->tenantId);

        try {
            $run = PayrollRun::withoutTenantScope()->find($event->payrollRunId);

            if ($run === null) {
                return;
            }

            AccountingConnection::withoutTenantScope()
                ->where('tenant_id', $event->tenantId)
                ->where('status', 'active')
                ->chunkById(100, function ($connections) use ($event): void {
                    foreach ($connections as $connection) {
                        SyncAccountingConnection::dispatch(
                            tenantId: $connection->tenant_id,
                            connectionId: $connection->id,
                            entityType: 'payroll_run',
                            entityId: $event->payrollRunId,
                        )->onQueue('integrations');
                    }
                });
        } finally {
            TenantContext::clear();
        }
    }
}
