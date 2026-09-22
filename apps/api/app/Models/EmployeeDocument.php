<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeDocument extends Model
{
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    protected $table = 'employee_documents';

    protected $fillable = [
        'company_id',
        'employee_id',
        'document_type_id',
        'uploaded_by',
        'title',
        'status',
        'expires_on',
    ];

    protected $casts = [
        'expires_on' => 'date',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function employee(): BelongsTo
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(
            Company::class,
            'company_id'
        );
    }

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(
            DocumentType::class,
            'document_type_id'
        );
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'uploaded_by'
        );
    }

    public function versions(): HasMany
    {
        return $this->hasMany(
            DocumentVersion::class,
            'employee_document_id'
        );
    }
}
