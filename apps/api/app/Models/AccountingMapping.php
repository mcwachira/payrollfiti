<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingMapping extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'accounting_mappings';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'accounting_connection_id',
        'entity_type',
        'local_code',
        'external_code',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function connection(): BelongsTo
    {
        return $this->belongsTo(AccountingConnection::class, 'accounting_connection_id');
    }
}
