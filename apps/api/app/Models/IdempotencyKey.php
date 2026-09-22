<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdempotencyKey extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'idempotency_keys';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'key',
        'request_hash',
        'response_status',
        'response_headers',
        'response_body',
        'locked_at',
        'completed_at',
    ];

    protected $casts = [
        'response_headers' => 'array',
        'response_body' => 'array',
        'response_status' => 'integer',
        'locked_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    public function isLocked(): bool
    {
        return $this->locked_at !== null;
    }

    public function markCompleted(
        int $status,
        ?array $headers,
        mixed $body,
    ): void {
        $this->forceFill([
            'response_status' => $status,
            'response_headers' => $headers,
            'response_body' => $body,
            'completed_at' => now(),
        ])->save();
    }
}
