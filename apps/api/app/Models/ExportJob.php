<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExportJob extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'export_jobs';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'requested_by',
        'export_type',
        'format',
        'status',
        'filters',
        'disk',
        'path',
        'completed_at',
        'expires_at',
        'error',
    ];

    protected $casts = [
        'filters' => 'array',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }
}
