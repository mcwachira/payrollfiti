<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OnboardingTask extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'onboarding_tasks';

    protected $fillable = [
        'tenant_id',
        'company_id',
        'employee_id',
        'title',
        'description',
        'status',
        'assigned_to',
        'completed_at',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [
        'completed_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
