<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'invitations';

    protected $fillable = ['tenant_id', 'company_id', 'invited_by', 'email', 'token_hash', 'status', 'expires_at', 'accepted_at'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];
}
