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
        'payroll_run_id',
        'employee_id',
        'gross_pay',
        'taxable_pay',
        'total_deductions',
        'employer_contributions',
        'net_pay',
        'breakdown',
    ];

    protected $casts = [
        'gross_pay' => 'decimal:2',
        'taxable_pay' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'employer_contributions' => 'decimal:2',
        'net_pay' => 'decimal:2',
        'breakdown' => 'array',
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

    public function items()
    {
        return $this->hasMany(
            PayrollEntryItem::class,
            'payroll_entry_id'
        );
    }
}
