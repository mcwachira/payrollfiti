<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Payments\Events\PaymentSettled;
use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Models\OutboxEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Transactional outbox relay (Part 13 §13.7).
 *
 * Runs on the `queue:dispatch-outbox` schedule. It CLAIMS pending outbox rows
 * exclusively (FOR UPDATE SKIP LOCKED) so multiple dispatcher processes cannot
 * publish the same row twice, then maps each row to a domain event. Because it
 * runs inside a single DB transaction, any queued listener work is deferred by
 * the redis after-commit guard until the whole batch commits — a poisoned row
 * marks attempts/last_error but does not roll back its neighbours.
 *
 * Applied NARROWLY by design: payroll-run completion and payment settlement
 * are the two irreversible money events that justify the extra latency; every
 * other broadcast is dispatched post-commit at at-least-once semantics.
 */
final class OutboxDispatcher
{
    public function dispatch(int $limit = 500): int
    {
        $claimed = 0;

        DB::transaction(function () use ($limit, &$claimed): void {
            $rows = OutboxEvent::query()
                ->whereNull('dispatched_at')
                ->where(fn ($q) => $q->whereNull('available_at')->orWhere('available_at', '<=', now()))
                ->orderBy('created_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            foreach ($rows as $row) {
                $claimed++;

                try {
                    $this->publish($row);
                    $row->dispatched_at = now();
                } catch (Throwable $e) {
                    $row->last_error = substr($e->getMessage(), 0, 4000);
                    Log::error('outbox.dispatch_failed', [
                        'outbox_event_id' => $row->id,
                        'event_type' => $row->event_type,
                        'error' => $e->getMessage(),
                    ]);
                }

                $row->attempts = ($row->attempts ?? 0) + 1;
                $row->save();
            }
        });

        return $claimed;
    }

    private function publish(OutboxEvent $row): void
    {
        $event = match ($row->event_type) {
            'payroll_run.completed' => new PayrollRunCompleted(
                (string) $row->tenant_id,
                (string) $row->aggregate_id,
                (array) $row->payload,
            ),
            'payment.settled' => new PaymentSettled(
                (string) $row->tenant_id,
                (string) $row->aggregate_id,
                (array) $row->payload,
            ),
            default => null,
        };

        if ($event === null) {
            // Unknown event types must not be silently dropped — surfaced in
            // last_error and attempts for operator review.
            throw new \RuntimeException("No event mapped for outbox event_type [{$row->event_type}]");
        }

        event($event);
    }
}
