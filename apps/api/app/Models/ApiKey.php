<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApiKey extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'api_keys';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'created_by',
        'name',
        'prefix',
        'status',
        'last_used_at',
        'expires_at',
        'revoked_at',
    ];

    protected $hidden = [
        'secret_hash',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(
            ApiKeyPermission::class,
            'api_key_id',
        );
    }

    public function usageRecords(): HasMany
    {
        return $this->hasMany(
            ApiKeyUsage::class,
            'api_key_id',
        );
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
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

    public function isUsable(): bool
    {
        return $this->isActive()
            && ! $this->isExpired()
            && ! $this->isRevoked();
    }

    public function revoke(): void
    {
        $this->forceFill([
            'status' => 'revoked',
            'revoked_at' => now(),
        ])->save();
    }

    public function markUsed(): void
    {
        $this->forceFill([
            'last_used_at' => now(),
        ])->save();
    }
}
