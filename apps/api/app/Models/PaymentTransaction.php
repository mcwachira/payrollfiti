<?php

namespace App\Models;

use App\Domain\Payments\Contracts\PaymentStatus;
use App\Domain\Payments\Events\PaymentFailed;
use App\Domain\Payments\Events\PaymentSucceeded;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

/**
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
#[Fillable(['tenant_id', 'invoice_id', 'provider', 'provider_transaction_id', 'idempotency_key', 'status', 'amount', 'currency', 'completed_at', 'provider_response'])]
class PaymentTransaction extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    private const TERMINAL_STATUSES = [
        'succeeded',
        'failed',
        'expired',
    ];

    private const ALLOWED_TRANSITIONS = [
        'pending' => ['processing', 'succeeded', 'failed', 'expired'],
        'processing' => ['succeeded', 'failed', 'expired'],
        'succeeded' => [],
        'failed' => [],
        'expired' => [],
    ];

    protected $casts = [
        'tenant_id' => 'string',
        'amount' => 'decimal:2',
        'completed_at' => 'datetime',
        'provider_response' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    /**
     * Transition this transaction to another status using the payment
     * state machine. Terminal statuses are immutable; a duplicate webhook
     * delivery (already terminal) is treated as a no-op and returns true.
     */
    public function transitionTo(string $status, ?string $providerTransactionId = null, ?array $providerResponse = null): bool
    {
        if (! in_array($status, array_column(PaymentStatus::cases(), 'value'), true)) {
            throw new InvalidArgumentException("Unknown payment status [{$status}].");
        }

        if ($this->status === $status) {
            return true;
        }

        $allowed = self::ALLOWED_TRANSITIONS[$this->status] ?? [];

        if (! in_array($status, $allowed, true)) {
            throw new InvalidArgumentException("Cannot transition payment from [{$this->status}] to [{$status}].");
        }

        $this->status = $status;

        if (in_array($status, self::TERMINAL_STATUSES, true)) {
            $this->completed_at = now();
        }

        $this->applyProviderTracking($providerTransactionId, $providerResponse);

        $this->save();

        match ($status) {
            'succeeded' => PaymentSucceeded::dispatch($this),
            'failed' => PaymentFailed::dispatch($this, 'Payment failed.'),
            default => null,
        };

        return true;
    }

    private function applyProviderTracking(?string $providerTransactionId, ?array $providerResponse): void
    {
        if ($providerTransactionId !== null) {
            $this->provider_transaction_id = $providerTransactionId;
        }

        if ($providerResponse !== null) {
            $this->provider_response = $providerResponse;
        }
    }
}
