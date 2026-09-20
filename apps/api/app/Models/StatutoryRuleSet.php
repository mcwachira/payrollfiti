<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StatutoryRuleSet extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'statutory_rule_sets';

    protected $fillable = [
        'country',
        'name',
        'version',
        'effective_from',
        'effective_to',
        'status',
        'configuration',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'configuration' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function rules(): HasMany
    {
        return $this->hasMany(
            StatutoryRule::class,
            'rule_set_id'
        );
    }
}
