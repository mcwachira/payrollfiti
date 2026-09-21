<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingSyncRecord extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'accounting_sync_records';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
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

    public function syncJob(): BelongsTo
    {
        return $this->belongsTo(
            AccountingSyncJob::class,
            'accounting_sync_job_id',
        );
    }
}
