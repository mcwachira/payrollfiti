<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebhookEndpoint extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'webhook_endpoints';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name',
        'url',
        'events',
        'status',
        'last_delivered_at',
    ];

    protected $hidden = [
        'secret_hash',
        'secret_ciphertext',
    ];

    protected $casts = [
        'secret_ciphertext' => 'encrypted',
        'events' => 'array',
        'last_delivered_at' => 'datetime',
    ];

    public function deliveryLogs(): HasMany
    {
        return $this->hasMany(
            WebhookDeliveryLog::class,
            'webhook_endpoint_id',
        );
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
