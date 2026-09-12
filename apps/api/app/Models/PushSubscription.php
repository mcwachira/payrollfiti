<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Web Push subscription registered by the user's browser. Endpoints are unique
 * per user; the columns map 1:1 to a PushSubscriptionJSON payload
 * (endpoint + keys.p256dh→public_key, keys.auth→auth_token). VAPID keys are
 * server-side in config/services.php — never leaked to this model.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class PushSubscription extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'push_subscriptions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'endpoint',
        'public_key',
        'auth_token',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
