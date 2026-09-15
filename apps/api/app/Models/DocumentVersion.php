<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DocumentVersion — immutable version history for an EmployeeDocument.
 *
 * Part 15 §15.4. Every upload creates a new version row; the current
 * file_path lives on EmployeeDocument while the full history is preserved here.
 */
class DocumentVersion extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'employee_document_id',
        'file_path',
        'file_name',
        'file_size',
        'mime_type',
        'uploaded_by',
        'version_number',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'version_number' => 'integer',
    ];

    public function employeeDocument(): BelongsTo
    {
        return $this->belongsTo(EmployeeDocument::class, 'employee_document_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
