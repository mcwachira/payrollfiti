<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalaryStructureComponent extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'salary_structure_components';

    protected $fillable = ['salary_structure_id', 'salary_component_id', 'amount', 'percentage', 'configuration', 'sort_order'];

    protected $casts = [
        'amount' => 'decimal:2',
        'percentage' => 'decimal:4',
        'configuration' => 'array',
        'sort_order' => 'integer',
    ];


    public $incrementing = false;

    protected $keyType = 'string';

    public function salaryStructure()
    {
        return $this->belongsTo(
            SalaryStructure::class,
            'salary_structure_id'
        );
    }

    public function salaryComponent()
    {
        return $this->belongsTo(
            SalaryComponent::class,
            'salary_component_id'
        );
    }
}
