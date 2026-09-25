<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'legal_name',
        'registration_number',
        'tax_number',
        'country',
        'currency',
        'email',
        'phone',
        'address',
        'status',
    ];

    protected $casts = [
        'address' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'company_id');
    }

    public function payrollRuns(): HasMany
    {
        return $this->hasMany(PayrollRun::class, 'company_id');
    }

    public function complianceReports(): HasMany
    {
        return $this->hasMany(ComplianceReport::class, 'company_id');
    }
}
