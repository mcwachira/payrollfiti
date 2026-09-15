<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\NotificationTypes;
use App\Domain\Payments\Events\PaymentSucceeded;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 14: queued listener that notifies the customer's users when a payment
 * succeeds. Recipients are the tenant's active users (each gated by their own
 * preferences). Runs on the `notifications` queue; idempotent via the payment
 * transaction entity key.
 */
final class NotifyPaymentSucceeded implements ShouldQueue
{
    public $queue = 'notifications';

    public $tries = 3;

    public $timeout = 60;

    public function handle(PaymentSucceeded $event): void
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
                NotificationTypes::BILLING_PAYMENT_SUCCEEDED,
                [
                    'transaction_id' => $transaction->id,
                    'amount' => $transaction->amount,
                    'currency' => $transaction->currency,
                    'entity_type' => 'payment_transaction',
                    'entity_id' => $transaction->id,
                ],
            );
        } finally {
            TenantContext::clear();
        }
    }
}
