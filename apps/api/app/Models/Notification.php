<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * In-app notification row written by the Part 14 notification dispatcher.
 * Read-state is tracked via read_at; fan-out to email/sms/push is tracked as
 * per-channel NotificationDelivery rows and performed by SendNotificationDelivery
 * on the `notifications` queue. Idempotency is enforced by dedupe_hash
 * (tenant + user + event + entity), so retried listeners never duplicate rows.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class Notification extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'notifications';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'template_id',
        'event_type',
        'dedupe_hash',
        'title',
        'body',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(NotificationTemplate::class, 'template_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(NotificationDelivery::class, 'notification_id');
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }
}
