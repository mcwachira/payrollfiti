<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Company extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = ['id', 'tenant_id', 'name', 'legal_name', 'registration_number', 'tax_number', 'country', 'currency', 'email', 'phone', 'address', 'status'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'address' => 'array',
    ];

    public function employees()
    {
        return $this->hasMany(Employee::class, 'company_id');
    }

    public function payrollRuns()
    {
        return $this->hasMany(PayrollRun::class, 'company_id');
    }

    public function complianceReports()
    {
        return $this->hasMany(ComplianceReport::class, 'company_id');
    }
}
