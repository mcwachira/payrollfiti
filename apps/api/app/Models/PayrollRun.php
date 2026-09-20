<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayrollRun extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'payroll_runs';

    protected $fillable = [
        'company_id',
        'payroll_period_id',
        'status',
        'period_start',
        'period_end',
        'pay_date',
        'input_hash',
        'rule_set_id',
        'rule_version',
        'input_snapshot',
        'rule_snapshot',
        'initiated_by',
        'approved_by',
        'approved_at',
        'finalized_by',
        'finalized_at',
        'corrects_run_id',
    ];

    protected $casts = [
        'input_snapshot' => 'array',
        'rule_snapshot' => 'array',
        'period_start' => 'date',
        'period_end' => 'date',
        'pay_date' => 'date',
        'approved_at' => 'datetime',
        'finalized_at' => 'datetime',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function ruleSet()
    {
        return $this->belongsTo(
            StatutoryRuleSet::class,
            'rule_set_id'
        );
    }
    public function payrollPeriod()
    {
        return $this->belongsTo(
            PayrollPeriod::class,
            'payroll_period_id'
        );
    }

    public function entries()
    {
        return $this->hasMany(
            PayrollEntry::class,
            'payroll_run_id'
        );
    }

    public function initiatedBy()
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function finalizedBy()
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    public function correctsRun()
    {
        return $this->belongsTo(
            PayrollRun::class,
            'corrects_run_id'
        );
    }

    public function corrections()
    {
        return $this->hasMany(
            PayrollRun::class,
            'corrects_run_id'
        );
    }
}
