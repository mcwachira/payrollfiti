<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecoveryCode extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'recovery_codes';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'two_factor_authentication_id',
        'code_hash',
        'used_at',
    ];

    protected $casts = [
        'used_at' => 'datetime',
    ];

    protected $hidden = [
        'code_hash',
    ];

    public function twoFactorAuthentication(): BelongsTo
    {
        return $this->belongsTo(TwoFactorAuthentication::class, 'two_factor_authentication_id');
    }
}
