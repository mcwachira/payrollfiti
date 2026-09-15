<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\NotificationTypes;
use App\Domain\Payments\Events\PaymentFailed;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 14: queued listener that notifies the customer's users when a payment
 * fails. Recipients are the tenant's users (each is gated by their own
 * preferences). Runs on the `notifications` queue; idempotent via the payment
 * transaction entity key.
 */
final class NotifyPaymentFailed implements ShouldQueue
{
    public $queue = 'notifications';

    public $tries = 3;

    public $timeout = 60;

    public function handle(PaymentFailed $event): void
    {
        $transaction = $event->transaction;

        TenantContext::set($transaction->tenant_id);

        try {
            $recipients = User::withoutTenantScope()
                ->where('tenant_id', $transaction->tenant_id)
                ->where('status', 'active')
                ->pluck('id')
                ->all();

            if ($recipients === []) {
                return;
            }

            app(NotificationDispatcher::class)->notify(
                $transaction->tenant_id,
                $recipients,
                NotificationTypes::BILLING_PAYMENT_FAILED,
                [
                    'transaction_id' => $transaction->id,
                    'amount' => $transaction->amount,
                    'currency' => $transaction->currency,
                    'reason' => $event->reason,
                    'entity_type' => 'payment_transaction',
                    'entity_id' => $transaction->id,
                ],
            );
        } finally {
            TenantContext::clear();
        }
    }
}
