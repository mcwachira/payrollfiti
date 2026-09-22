<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NotificationTemplate extends Model
{
    use HasUuids;

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

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'template_id');
    }

    public static function forTenantAndChannel(
        string $tenantId,
        string $eventType,
        string $channel,
    ): ?self {
        return static::query()
            ->where('code', $eventType)
            ->where('channel', $channel)
            ->where('active', true)
            ->where(function (Builder $query) use ($tenantId): void {
                $query
                    ->where('tenant_id', $tenantId)
                    ->orWhereNull('tenant_id');
            })
            ->orderByRaw(
                'CASE WHEN tenant_id = ? THEN 0 ELSE 1 END',
                [$tenantId],
            )
            ->orderByDesc('updated_at')
            ->first();
    }
}
