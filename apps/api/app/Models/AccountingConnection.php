<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingConnection extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'accounting_connections';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'provider',
        'status',
        'access_token_encrypted',
        'refresh_token_encrypted',
        'token_expires_at',
        'external_account_id',
        'metadata',
    ];

    protected $hidden = [
        'access_token_encrypted',
        'refresh_token_encrypted',
    ];

    protected $casts = [
        'access_token_encrypted' => 'encrypted',
        'refresh_token_encrypted' => 'encrypted',
        'token_expires_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(
            Company::class,
            'company_id',
        );
    }

    public function syncJobs(): HasMany
    {
        return $this->hasMany(
            AccountingSyncJob::class,
            'accounting_connection_id',
        );
    }

    public function mappings(): HasMany
    {
        return $this->hasMany(
            AccountingMapping::class,
            'accounting_connection_id',
        );
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
