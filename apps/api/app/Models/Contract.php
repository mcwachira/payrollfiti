<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contract extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'employee_id',
        'contract_number',
        'contract_type',
        'status',
        'job_title',
        'start_date',
        'end_date',
        'probation_end_date',
        'notice_period_days',
        'working_hours_per_week',
        'salary_structure_id',
        'notes',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'probation_end_date' => 'date',
        'notice_period_days' => 'integer',
        'working_hours_per_week' => 'decimal:2',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function employee(): BelongsTo
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }

    public function salaryStructure(): BelongsTo
    {
        return $this->belongsTo(
            SalaryStructure::class,
            'salary_structure_id'
        );
    }
}

