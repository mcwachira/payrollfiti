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
        'tenant_id',
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
        'initiated_by',
        'approved_by',
        'approved_at',
        'finalized_by',
        'finalized_at',
        'corrects_run_id',
    ];

    protected $casts = [
        'input_snapshot' => 'array',
        'approved_at' => 'datetime',
        'finalized_at' => 'datetime',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function tenant()
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function entries()
    {
        return $this->hasMany(PayrollEntry::class, 'payroll_run_id');
    }
}
