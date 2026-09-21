<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSession extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'user_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'ip_address',
        'user_agent',
        'last_active_at',
        'expires_at',
        'revoked_at',
    ];

    protected $hidden = [
        'session_hash',
    ];

    protected $casts = [
        'last_active_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null
            && $this->expires_at->isPast();
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isActive(): bool
    {
        return ! $this->isRevoked() && ! $this->isExpired();
    }

    public function revoke(): void
    {
        $this->forceFill([
            'revoked_at' => now(),
        ])->save();
    }
}
