<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComplianceReport extends Model
{
    use BelongsToTenant;
    use HasFactory;
    use HasUuids;

    protected $table = 'compliance_reports';

    protected $fillable = [
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

    public function company(): BelongsTo
    {
        return $this->belongsTo(
            Company::class,
            'company_id',
        );
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(
            PayrollRun::class,
            'payroll_run_id',
        );
    }
}
