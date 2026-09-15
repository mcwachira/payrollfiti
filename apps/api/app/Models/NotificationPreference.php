<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-user, per-event-type channel opt-in. Unique on (user_id, event_type).
 * Missing rows fall back to the defaults in NotificationTypes::defaults(),
 * so a user does not need an explicit row to start receiving notifications.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class NotificationPreference extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'notification_preferences';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'event_type',
        'in_app',
        'email',
        'sms',
        'push',
    ];

    protected $casts = [
        'in_app' => 'boolean',
        'email' => 'boolean',
        'sms' => 'boolean',
        'push' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isEnabled(string $channel): bool
    {
        return (bool) $this->{$channel};
    }

    /** @return string[] enabled channel keys */
    public function enabledChannels(): array
    {
        return array_values(array_filter(
            ['in_app', 'email', 'sms', 'push'],
            fn (string $channel) => $this->isEnabled($channel),
        ));
    }
}
