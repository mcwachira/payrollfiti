<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Enums\WebhookDeliveryStatus;

class WebhookDeliveryLog extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'webhook_delivery_logs';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
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
        'status' => WebhookDeliveryStatus::class,
        'attempts' => 'integer',
        'response_status' => 'integer',
        'response_time_ms' => 'integer',
        'delivered_at' => 'datetime',
        'next_attempt_at' => 'datetime',
    ];

    public function endpoint(): BelongsTo
    {
        return $this->belongsTo(
            WebhookEndpoint::class,
            'webhook_endpoint_id',
        );
    }

    public function incrementAttempts(): void
    {
        $this->increment('attempts');
    }

    public function markDelivered(
        ?int $responseStatus = null,
        ?int $responseTimeMs = null,
        ?string $responseBody = null,
    ): void {
        $this->forceFill([
            'status' => 'delivered',
            'response_status' => $responseStatus,
            'response_time_ms' => $responseTimeMs,
            'response_body' => $responseBody,
            'error' => null,
            'delivered_at' => now(),
            'next_attempt_at' => null,
        ])->save();
    }

    public function markFailed(
        string $error,
        ?int $responseStatus = null,
        ?int $responseTimeMs = null,
        ?string $responseBody = null,
    ): void {
        $this->forceFill([
            'status' => 'failed',
            'response_status' => $responseStatus,
            'response_time_ms' => $responseTimeMs,
            'response_body' => $responseBody,
            'error' => $error,
        ])->save();
    }
}
