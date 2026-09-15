<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TwoFactorAuthentication extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'two_factor_authentications';

    protected $fillable = ['tenant_id', 'user_id', 'secret_encrypted', 'enabled', 'confirmed_at'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'enabled' => 'boolean',
        'confirmed_at' => 'datetime',
    ];
}
