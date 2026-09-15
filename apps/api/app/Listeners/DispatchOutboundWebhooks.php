<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Payments\Events\PaymentSettled;
use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Jobs\DeliverWebhook;
use App\Models\PayrollRun;
use App\Models\WebhookEndpoint;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 13 §13.5: queued listener that fans an outbox-published domain event
 * out to every active tenant webhook endpoint subscribed to that event type,
 * dispatching one DeliverWebhook job (webhooks queue) per endpoint.
 *
 * One endpoint failing cannot delay the others — they are independent queue
 * entries. A listener retry re-checks endpoint/run existence so it can never
 * dispatch delivery for an endpoint that was disabled mid-flight.
 */
final class DispatchOutboundWebhooks implements ShouldQueue
{
    public $queue = 'webhooks';

    public $tries = 3;

    public $timeout = 60;

    public function handle(PayrollRunCompleted|PaymentSettled $event): void
    {
        [$tenantId, $eventType, $eventId, $payload] = $this->eventContext($event);

        TenantContext::set($tenantId);

        try {
            WebhookEndpoint::withoutTenantScope()
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->chunkById(200, function ($endpoints) use ($eventType, $eventId, $payload): void {
                    foreach ($endpoints as $endpoint) {
                        if (! in_array($eventType, (array) $endpoint->events, true)) {
                            continue;
                        }

                        DeliverWebhook::dispatch(
                            tenantId: $endpoint->tenant_id,
                            endpointId: $endpoint->id,
                            eventType: $eventType,
                            eventId: $eventId,
                            payload: $payload,
                        )->onQueue('webhooks');
                    }
                });
        } finally {
            TenantContext::clear();
        }
    }

    private function eventContext(PayrollRunCompleted|PaymentSettled $event): array
    {
        if ($event instanceof PayrollRunCompleted) {
            $run = PayrollRun::withoutTenantScope()->find($event->payrollRunId);

            return [
                $event->tenantId,
                'payroll_run.completed',
                $event->payrollRunId,
                [
                    'id' => $event->payrollRunId,
                    'type' => 'payroll_run.completed',
                    'company_id' => $run?->company_id,
                    'period_start' => $run?->period_start?->toDateString(),
                    'period_end' => $run?->period_end?->toDateString(),
                ],
            ];
        }

        return [
            $event->tenantId,
            'payment.settled',
            $event->paymentTransactionId,
            [
                'id' => $event->paymentTransactionId,
                'type' => 'payment.settled',
                'invoice_id' => $event->invoiceId(),
                'provider' => $event->provider(),
            ],
        ];
    }
}
