<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RecoveryCode extends Model
{
    use HasUuids;

    protected $table = 'recovery_codes';

    protected $fillable = ['two_factor_authentication_id', 'code_hash', 'used_at'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'used_at' => 'datetime',
    ];

    public function twoFactorAuthentication()
    {
        return $this->belongsTo(TwoFactorAuthentication::class, 'two_factor_authentication_id');
    }
}
