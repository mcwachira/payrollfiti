<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class UserSession extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'user_sessions';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'session_hash',
        'ip_address',
        'user_agent',
        'last_active_at',
        'expires_at',
        'revoked_at',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'last_active_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
