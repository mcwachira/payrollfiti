<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'notification_preferences';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isEnabled(string $channel): bool
    {
        return (bool) $this->{$channel};
    }

    public function enabledChannels(): array
    {
        return array_values(array_filter(
            ['in_app', 'email', 'sms', 'push'],
            fn (string $channel): bool => $this->isEnabled($channel),
        ));
    }
}
