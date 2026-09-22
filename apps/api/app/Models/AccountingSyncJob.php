<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingSyncJob extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'accounting_sync_jobs';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'accounting_connection_id',
        'entity_type',
        'status',
        'started_at',
        'completed_at',
        'error',
        'filters',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'filters' => 'array',
    ];

    public function connection(): BelongsTo
    {
        return $this->belongsTo(
            AccountingConnection::class,
            'accounting_connection_id',
        );
    }

    public function records(): HasMany
    {
        return $this->hasMany(
            AccountingSyncRecord::class,
            'accounting_sync_job_id',
        );
    }
}
