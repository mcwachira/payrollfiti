<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'employees';

    protected $fillable = [
        'company_id',
        'department_id',
        'position_id',
        'work_location_id',
        'salary_structure_id',
        'employee_number',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'phone',
        'country',
        'hire_date',
        'termination_date',
        'status',
        'date_of_birth',
        'gender',
    ];
    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'hire_date' => 'date',
        'termination_date' => 'date',
        'date_of_birth' => 'date',
        'national_id' => 'encrypted',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function position()
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function workLocation()
    {
        return $this->belongsTo(WorkLocation::class, 'work_location_id');
    }

    public function salaryStructure()
    {
        return $this->belongsTo(SalaryStructure::class, 'salary_structure_id');
    }

    public function payrollEntries()
    {
        return $this->hasMany(PayrollEntry::class, 'employee_id');
    }
}
