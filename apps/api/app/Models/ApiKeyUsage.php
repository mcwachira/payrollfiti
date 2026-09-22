<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiKeyUsage extends Model
{
    use BelongsToTenant;
    use HasUuids;

    protected $table = 'api_key_usage';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'api_key_id',
        'endpoint',
        'method',
        'response_status',
        'response_time_ms',
        'used_at',
    ];

    protected $casts = [
        'response_status' => 'integer',
        'response_time_ms' => 'integer',
        'used_at' => 'datetime',
    ];

    public function apiKey(): BelongsTo
    {
        return $this->belongsTo(
            ApiKey::class,
            'api_key_id',
        );
    }
}
