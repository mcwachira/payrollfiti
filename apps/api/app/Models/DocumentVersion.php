<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVersion extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'document_versions';

    protected $fillable = [
        'employee_document_id',
        'uploaded_by',
        'version',
        'disk',
        'path',
        'original_filename',
        'mime_type',
        'size',
        'checksum',
        'uploaded_at',
    ];

    protected $casts = [
        'version' => 'integer',
        'size' => 'integer',
        'uploaded_at' => 'datetime',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function employeeDocument(): BelongsTo
    {
        return $this->belongsTo(
            EmployeeDocument::class,
            'employee_document_id'
        );
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'uploaded_by'
        );
    }
}
