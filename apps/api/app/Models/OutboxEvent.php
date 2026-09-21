<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OutboxEvent extends Model
{
    use HasUuids;

    protected $table = 'outbox_events';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'event_type',
        'aggregate_type',
        'aggregate_id',
        'payload',
        'available_at',
        'dispatched_at',
        'attempts',
        'last_error',
    ];

    protected $casts = [
        'payload' => 'array',
        'available_at' => 'datetime',
        'dispatched_at' => 'datetime',
        'attempts' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function scopePending(
        Builder $query,
        ?int $limit = null,
    ): Builder {
        $query
            ->whereNull('dispatched_at')
            ->where(function (Builder $query): void {
                $query
                    ->whereNull('available_at')
                    ->orWhere('available_at', '<=', now());
            })
            ->orderBy('created_at');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query;
    }

    public function isPending(): bool
    {
        return $this->dispatched_at === null;
    }

    public function markDispatched(): void
    {
        $this->forceFill([
            'dispatched_at' => now(),
            'last_error' => null,
        ])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'attempts' => $this->attempts + 1,
            'last_error' => $error,
        ])->save();
    }
}
