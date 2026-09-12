<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An OAuth authorization linking a tenant company to an accounting platform
 * (Xero / QuickBooks / Zoho Books). Credentials are stored encrypted
 * (access_token_encrypted / refresh_token_encrypted). When no connection
 * exists, accounting-sync jobs no-op safely.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class AccountingConnection extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'accounting_connections';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'company_id',
        'provider',
        'status',
        'access_token_encrypted',
        'refresh_token_encrypted',
        'token_expires_at',
        'external_account_id',
        'metadata',
    ];

    protected $casts = [
        'token_expires_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected $hidden = [
        'access_token_encrypted',
        'refresh_token_encrypted',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function syncJobs(): HasMany
    {
        return $this->hasMany(AccountingSyncJob::class, 'accounting_connection_id');
    }

    public function mappings(): HasMany
    {
        return $this->hasMany(AccountingMapping::class, 'accounting_connection_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
