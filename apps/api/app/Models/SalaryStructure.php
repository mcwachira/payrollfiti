<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalaryStructure extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'salary_structures';

    protected $fillable = ['company_id', 'tenant_id', 'name', 'code', 'currency', 'active'];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function components()
    {
        return $this->hasMany(SalaryStructureComponent::class, 'salary_structure_id');
    }
}
