<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PayrollSetting extends Model
{
    use BelongsToTenant, HasFactory, HasUuids;

    protected $table = 'payroll_settings';

    protected $fillable = [
        'company_id',
        'frequency',
        'currency',
        'default_rule_set_id',
        'configuration',
    ];

    protected $casts = [
        'configuration' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function defaultRuleSet()
    {
        return $this->belongsTo(
            StatutoryRuleSet::class,
            'default_rule_set_id'
        );
    }
}
