<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Row-level result of an accounting sync unit. The unique constraint
 * (accounting_sync_job_id, entity_type, local_id) makes retries idempotent:
 * re-running a job can never create a second external sync record.
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|static withoutTenantScope()
 */
class AccountingSyncRecord extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'accounting_sync_records';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'accounting_sync_job_id',
        'entity_type',
        'local_id',
        'external_id',
        'status',
        'error',
        'response',
    ];

    protected $casts = [
        'response' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function syncJob(): BelongsTo
    {
        return $this->belongsTo(AccountingSyncJob::class, 'accounting_sync_job_id');
    }
}
