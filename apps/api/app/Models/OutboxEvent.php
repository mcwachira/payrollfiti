<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Transactional outbox (Part 13 §13.7).
 *
 * Written inside the same DB transaction that completes the business state
 * change (payroll-run completion, payment settlement), then claimed by the
 * queue:dispatch-outbox command with FOR UPDATE SKIP LOCKED and translated
 * into domain events exactly once.
 *
 * Deliberately NOT a BelongsToTenant model: the outbox is platform-level
 * infrastructure and is often written before any tenant context exists
 * (e.g. payment settlement). Tenant scope is verified inside each event's
 * listeners via the tenant_id column.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static pending()
 */
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

    public function scopePending($query, ?int $limit = null)
    {
        $query->whereNull('dispatched_at')
            ->where(function ($q) {
                $q->whereNull('available_at')->orWhere('available_at', '<=', now());
            })
            ->orderBy('created_at');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query;
    }

    /** True when the event has not yet been converted into a domain event. */
    public function isPending(): bool
    {
        return $this->dispatched_at === null;
    }
}
