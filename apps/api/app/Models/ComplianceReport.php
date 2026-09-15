<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ComplianceReport extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'compliance_reports';

    protected $fillable = [
        'tenant_id',
        'company_id',
        'payroll_run_id',
        'country',
        'report_code',
        'report_version',
        'status',
        'generated_at',
        'rows',
        'totals',
        'metadata',
    ];

    protected $casts = [
        'generated_at' => 'datetime',
        'rows' => 'array',
        'totals' => 'array',
        'metadata' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function payrollRun()
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }
}
