<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PaySchedule extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'pay_schedules';

    protected $fillable = [
        'company_id',
        'name',
        'frequency',
        'pay_day',
        'active',
    ];

    protected $casts = [
        'pay_day' => 'integer',
        'active' => 'boolean',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company()
    {
        return $this->belongsTo(
            Company::class,
            'company_id'
        );
    }

    public function payrollPeriods()
    {
        return $this->hasMany(
            PayrollPeriod::class,
            'pay_schedule_id'
        );
    }
}
