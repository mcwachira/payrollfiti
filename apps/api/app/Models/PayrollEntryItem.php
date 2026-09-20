<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PayrollEntryItem extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'payroll_entry_items';

    protected $fillable = [
        'payroll_entry_id',
        'salary_component_id',
        'code',
        'name',
        'type',
        'amount',
        'calculation_metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'calculation_metadata' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function payrollEntry()
    {
        return $this->belongsTo(
            PayrollEntry::class,
            'payroll_entry_id'
        );
    }

    public function salaryComponent()
    {
        return $this->belongsTo(
            SalaryComponent::class,
            'salary_component_id'
        );
    }
}
