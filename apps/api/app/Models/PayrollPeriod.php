<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PayrollPeriod extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'payroll_periods';

    protected $fillable = ['company_id', 'tenant_id', 'pay_schedule_id', 'period_start', 'period_end', 'pay_date', 'status'];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
