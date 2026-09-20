<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PayrollPeriod extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'payroll_periods';

    protected $fillable = [
        'company_id',
        'pay_schedule_id',
        'period_start',
        'period_end',
        'pay_date',
        'status',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'pay_date' => 'date',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function paySchedule()
    {
        return $this->belongsTo(
            PaySchedule::class,
            'pay_schedule_id'
        );
    }

    public function payrollRuns()
    {
        return $this->hasMany(
            PayrollRun::class,
            'payroll_period_id'
        );
    }
}
