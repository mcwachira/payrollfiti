<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
#[Fillable(['tenant_id', 'provider', 'provider_event_id', 'event_type', 'payload', 'status', 'processed_at', 'processing_error'])]
class PaymentProviderEvent extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'payment_provider_events';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'tenant_id' => 'string',
        'payload' => 'array',
        'processed_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
