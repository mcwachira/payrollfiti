<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-delivery record for an outbound webhook. Written idempotently per
 * (endpoint, event_type, event_id). `status` moves pending -> delivered /
 * failed and carries provider-side response metadata for debugging.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class WebhookDeliveryLog extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'webhook_delivery_logs';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'webhook_endpoint_id',
        'event_type',
        'event_id',
        'status',
        'attempts',
        'response_status',
        'response_time_ms',
        'response_body',
        'error',
        'delivered_at',
        'next_attempt_at',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'response_status' => 'integer',
        'response_time_ms' => 'integer',
        'delivered_at' => 'datetime',
        'next_attempt_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function endpoint(): BelongsTo
    {
        return $this->belongsTo(WebhookEndpoint::class, 'webhook_endpoint_id');
    }
}
