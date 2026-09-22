<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class PaymentProviderEvent extends Model
{
    use HasFactory;
    use HasUuids;

    protected $table = 'payment_provider_events';

    protected $fillable = [
        'provider',
        'provider_event_id',
        'event_type',
        'payload',
        'status',
        'processed_at',
        'processing_error',
    ];

    protected $casts = [
        'payload' => 'array',
        'processed_at' => 'datetime',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Processing
    |--------------------------------------------------------------------------
    */

    public function markProcessing(): void
    {
        $this->update([
            'status' => 'processing',
            'processing_error' => null,
        ]);
    }

    public function markProcessed(): void
    {
        $this->update([
            'status' => 'processed',
            'processed_at' => now(),
            'processing_error' => null,
        ]);
    }

    public function markFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'processing_error' => $error,
        ]);
    }

    public function isProcessed(): bool
    {
        return $this->status === 'processed';
    }

    public function hasFailed(): bool
    {
        return $this->status === 'failed';
    }
}
