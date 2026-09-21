<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Timesheet extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'timesheets';

    protected $fillable = [
        'company_id',
        'employee_id',
        'approved_by',
        'period_start',
        'period_end',
        'regular_hours',
        'overtime_hours',
        'status',
        'approved_at',
        'summary',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'regular_hours' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'approved_at' => 'datetime',
        'summary' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company(): BelongsTo
    {
        return $this->belongsTo(
            Company::class,
            'company_id'
        );
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'approved_by'
        );
    }
}
