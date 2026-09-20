<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalaryComponent extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'salary_components';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'type',
        'calculation_type',
        'taxable',
        'statutory',
        'configuration',
    ];

    protected $casts = [
        'taxable' => 'boolean',
        'statutory' => 'boolean',
        'configuration' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company(): BelongsTo
    {
        return $this->belongsTo(
            Company::class,
            'company_id'
        );
    }

    public function salaryStructureComponents(): HasMany
    {
        return $this->hasMany(
            SalaryStructureComponent::class,
            'salary_component_id'
        );
    }

    public function payrollEntryItems(): HasMany
    {
        return $this->hasMany(
            PayrollEntryItem::class,
            'salary_component_id'
        );
    }
}
