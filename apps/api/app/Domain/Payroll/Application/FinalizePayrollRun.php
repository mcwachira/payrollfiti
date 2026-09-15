<?php

declare(strict_types=1);

namespace App\Domain\Payroll\Application;

use App\Models\OutboxEvent;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Finalizes a payroll run and records it in the transactional outbox (Part 13
 * §13.7) — atomically, in the SAME database transaction.
 *
 * Guarantees:
 *  - The run cannot flip from approved→finalized without its completion event
 *    landing in outbox_events; and a rolled-back transaction leaves no orphan
 *    event, so a queued job can never claim a run that never finalized.
 *  - Idempotent: calling finalize on an already-finalized run is a no-op (so
 *    an HTTP retry cannot double-emit payroll_run.completed).
 *  - Race-safe: the run row is locked FOR UPDATE inside the transaction.
 */
final class FinalizePayrollRun
{
    public const ALLOWED_FROM = ['approved'];

    public function handle(PayrollRun $run, User $user): PayrollRun
    {
        return DB::transaction(function () use ($run, $user): PayrollRun {
            /** @var PayrollRun $fresh */
            $fresh = PayrollRun::withoutTenantScope()
                ->whereKey($run->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($fresh->status === 'finalized') {
                Log::info('finalize_payroll_run.already_finalized', ['payroll_run_id' => $fresh->id]);

                return $fresh;
            }

            if (! in_array($fresh->status, self::ALLOWED_FROM, true)) {
                throw new RuntimeException("Cannot finalize payroll run in status [{$fresh->status}]");
            }

            $fresh->forceFill([
                'status' => 'finalized',
                'finalized_by' => $user->id,
                'finalized_at' => now(),
            ])->save();

            OutboxEvent::create([
                'tenant_id' => $fresh->tenant_id,
                'event_type' => 'payroll_run.completed',
                'aggregate_type' => 'payroll_run',
                'aggregate_id' => $fresh->id,
                'payload' => [
                    'finalized_by' => $user->id,
                    'finalized_at' => now()->toISOString(),
                ],
                'available_at' => now(),
            ]);

            return $fresh;
        });
    }
}
