<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TwoFactorAuthentication extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'two_factor_authentications';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'secret_encrypted',
        'enabled',
        'confirmed_at',
    ];

    protected $hidden = [
        'secret_encrypted',
    ];

    protected $casts = [
        'secret_encrypted' => 'encrypted',
        'enabled' => 'boolean',
        'confirmed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function recoveryCodes(): HasMany
    {
        return $this->hasMany(
            RecoveryCode::class,
            'two_factor_authentication_id',
        );
    }

    public function isConfirmed(): bool
    {
        return $this->confirmed_at !== null;
    }

    public function isEnabled(): bool
    {
        return $this->enabled && $this->isConfirmed();
    }

    public function enable(): void
    {
        $this->forceFill([
            'enabled' => true,
        ])->save();
    }

    public function disable(): void
    {
        $this->forceFill([
            'enabled' => false,
        ])->save();
    }
}
