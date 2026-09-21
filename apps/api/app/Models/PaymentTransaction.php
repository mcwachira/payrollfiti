<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class PaymentTransaction extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use HasUuids;

    protected $table = 'payment_transactions';

    protected $fillable = [
        'invoice_id',
        'provider',
        'provider_transaction_id',
        'idempotency_key',
        'status',
        'amount',
        'currency',
        'completed_at',
        'provider_response',
    ];

    protected $casts = [
        'status' => PaymentStatus::class,
        'amount' => 'decimal:2',
        'completed_at' => 'datetime',
        'provider_response' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    /*
    |--------------------------------------------------------------------------
    | State
    |--------------------------------------------------------------------------
    */

    public function transitionTo(PaymentStatus $status): void
    {
        $current = $this->status;

        if ($current === $status) {
            return;
        }

        if ($current !== null && ! $this->canTransitionTo($status)) {
            throw new LogicException(
                sprintf(
                    'Payment transaction cannot transition from [%s] to [%s].',
                    $current->value,
                    $status->value,
                )
            );
        }

        $this->status = $status;

        if ($status->isTerminal()) {
            $this->completed_at ??= now();
        }

        $this->save();
    }

    public function canTransitionTo(PaymentStatus $status): bool
    {
        return match ($this->status) {
            PaymentStatus::Pending => in_array(
                $status,
                [
                    PaymentStatus::Processing,
                    PaymentStatus::Succeeded,
                    PaymentStatus::Failed,
                    PaymentStatus::Expired,
                ],
                true
            ),

            PaymentStatus::Processing => in_array(
                $status,
                [
                    PaymentStatus::Succeeded,
                    PaymentStatus::Failed,
                    PaymentStatus::Expired,
                ],
                true
            ),

            PaymentStatus::Succeeded,
            PaymentStatus::Failed,
            PaymentStatus::Expired => false,

            null => true,
        };
    }

    public function isTerminal(): bool
    {
        return $this->status?->isTerminal() ?? false;
    }

    public function isSuccessful(): bool
    {
        return $this->status === PaymentStatus::Succeeded;
    }
}
