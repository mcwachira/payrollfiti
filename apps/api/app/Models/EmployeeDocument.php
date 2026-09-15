<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * EmployeeDocument — an uploaded document belonging to an employee.
 *
 * Part 15 §15.4. Each row is a versioned attachment tied to an employee
 * and a DocumentType. `status` tracks the lifecycle (pending/approved/rejected)
 * so HR can verify identity documents before they count toward compliance.
 */
class EmployeeDocument extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'company_id',
        'employee_id',
        'document_type_id',
        'uploaded_by',
        'title',
        'file_path',
        'file_name',
        'file_size',
        'mime_type',
        'status',
        'verified_at',
        'verified_by',
        'metadata',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'verified_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class, 'document_type_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class, 'employee_document_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
