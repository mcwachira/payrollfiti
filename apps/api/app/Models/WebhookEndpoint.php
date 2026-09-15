<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A tenant-registered endpoint that receives outbound webhook deliveries when
 * subscribed events occur. The webhook secret is stored hashed (secret_hash),
 * never in plaintext, and delivered payloads are signed with HMAC-SHA-256 over
 * the raw body using the shared secret.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class WebhookEndpoint extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'webhook_endpoints';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'name',
        'url',
        'secret_hash',
        'secret_ciphertext',
        'events',
        'status',
        'last_delivered_at',
    ];

    protected $casts = [
        'events' => 'array',
        'last_delivered_at' => 'datetime',
    ];

    protected $hidden = [
        'secret_hash',
        'secret_ciphertext',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function deliveryLogs(): HasMany
    {
        return $this->hasMany(WebhookDeliveryLog::class, 'webhook_endpoint_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
