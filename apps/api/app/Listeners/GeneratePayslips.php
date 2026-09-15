<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Jobs\GeneratePayslip;
use App\Models\PayrollEntry;
use App\Models\Payslip;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 13 §13.5: queued listener that fans a completed payroll run out into
 * ONE GeneratePayslip job per payroll entry on the `payroll` queue — never one
 * giant job for the whole run, and never synchronous in an HTTP request.
 *
 * Each job being independent means one employee's render failure retries and
 * fails in isolation; it never blocks or duplicates the other entries.
 */
final class GeneratePayslips implements ShouldQueue
{
    public $queue = 'payroll';

    public $tries = 3;

    public $timeout = 120;

    public function handle(PayrollRunCompleted $event): void
    {
        TenantContext::set($event->tenantId);

        try {
            PayrollEntry::withoutTenantScope()
                ->where('tenant_id', $event->tenantId)
                ->where('payroll_run_id', $event->payrollRunId)
                ->with(['payrollRun.company', 'employee'])
                ->chunkById(100, function ($entries): void {
                    foreach ($entries as $entry) {
                        $alreadyGenerated = Payslip::where('payroll_entry_id', $entry->id)
                            ->exists();

                        if ($alreadyGenerated) {
                            // Re-dispatch after a listener/queue hiccup must not
                            // re-queue entries that already have a payslip.
                            continue;
                        }

                        GeneratePayslip::dispatch($entry->tenant_id, $entry->id)
                            ->onQueue('payroll');
                    }
                });
        } finally {
            TenantContext::clear();
        }
    }
}
