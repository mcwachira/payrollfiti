<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Delivery bookkeeping for one channel of one notification. Unique on
 * (notification_id, channel).
 *
 * Status lifecycle:
 *   queued  → created by the dispatcher, not yet picked up
 *   sent    → channel/back-end provider accepted the payload (sent_at set)
 *   failed  → job dead-lettered (max tries exhausted) — failed_at set
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class NotificationDelivery extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'notification_deliveries';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'notification_id',
        'channel',
        'status',
        'attempts',
        'sent_at',
        'failed_at',
        'last_error',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class, 'notification_id');
    }

    public function markSent(): void
    {
        $this->forceFill([
            'status' => 'sent',
            'sent_at' => Carbon::now(),
            'failed_at' => null,
            'last_error' => null,
        ])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'status' => 'failed',
            'failed_at' => Carbon::now(),
            'last_error' => $error,
        ])->save();
    }

    public function incrementAttempts(): void
    {
        $this->increment('attempts');
    }
}
