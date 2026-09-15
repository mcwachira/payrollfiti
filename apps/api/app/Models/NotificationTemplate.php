<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Notification template. A row with tenant_id = null is a platform-wide
 * template; a row with a tenant_id overrides it for that tenant. Templates are
 * selected per channel (in_app / email / sms / push). The `variables` JSON
 * column lists the ONLY placeholders that may be interpolated into subject /
 * body (defence against injection via event data).
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class NotificationTemplate extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'notification_templates';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'code',
        'channel',
        'subject',
        'body',
        'variables',
        'active',
    ];

    protected $casts = [
        'variables' => 'array',
        'active' => 'boolean',
    ];

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'template_id');
    }

    /**
     * Resident template for a tenant + event + channel: tenant-specific row
     * wins over the platform-wide (tenant_id NULL) row.
     */
    public static function forTenantAndChannel(string $tenantId, string $eventType, string $channel): ?self
    {
        return static::withoutTenantScope()
            ->where('code', $eventType)
            ->where('channel', $channel)
            ->where('active', true)
            ->where(fn ($query) => $query->where('tenant_id', $tenantId)->orWhereNull('tenant_id'))
            ->orderByRaw('CASE WHEN tenant_id = ? THEN 0 ELSE 1 END', [$tenantId])
            ->orderByDesc('updated_at')
            ->first();
    }
}
