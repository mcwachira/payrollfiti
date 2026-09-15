<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * DocumentType — the configurable categories an employee document can belong
 * to (Part 15 §15.4), e.g. NATIONAL-ID, PASSPORT, CONTRACT. `required` flags a
 * type every employee should have; `active` gates new uploads.
 */
class DocumentType extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'company_id',
        'name',
        'code',
        'required',
        'active',
    ];

    protected $casts = [
        'required' => 'boolean',
        'active' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class, 'document_type_id');
    }
}
