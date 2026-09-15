<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
#[Fillable(['tenant_id', 'subscription_id', 'invoice_number', 'status', 'billing_period_start', 'billing_period_end', 'subtotal', 'tax', 'total', 'currency', 'issued_at', 'due_at', 'paid_at', 'provider', 'provider_invoice_id', 'line_items'])]
class Invoice extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'tenant_id' => 'string',
        'billing_period_start' => 'date',
        'billing_period_end' => 'date',
        'issued_at' => 'datetime',
        'due_at' => 'datetime',
        'paid_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'line_items' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class, 'subscription_id');
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class, 'invoice_id');
    }

    public function isSettled(): bool
    {
        return in_array($this->status, ['paid', 'void'], true);
    }
}
