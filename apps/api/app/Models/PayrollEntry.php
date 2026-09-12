<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PayrollEntry extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'payroll_entries';

    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'payroll_run_id',
        'employee_id',
        'gross_pay',
        'taxable_pay',
        'total_deductions',
        'employer_contributions',
        'net_pay',
        'breakdown',
        'created_at',
    ];

    protected $casts = [
        'breakdown' => 'array',
        'gross_pay' => 'string',
        'taxable_pay' => 'string',
        'total_deductions' => 'string',
        'employer_contributions' => 'string',
        'net_pay' => 'string',
        'created_at' => 'datetime',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function payrollRun()
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
