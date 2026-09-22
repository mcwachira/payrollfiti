<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Enums\InvitationStatus;

class Invitation extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'invitations';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'invited_by',
        'email',
        'status',
        'expires_at',
        'accepted_at',
    ];

    protected $hidden = [
        'token_hash',
    ];

    protected $casts = [
        'status' => InvitationStatus::class,
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->accepted_at !== null;
    }
}
