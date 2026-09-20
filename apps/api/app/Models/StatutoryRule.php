<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StatutoryRule extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'statutory_rules';

    protected $fillable = [
        'rule_set_id',
        'code',
        'name',
        'type',
        'configuration',
    ];

    protected $casts = [
        'configuration' => 'array',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function ruleSet(): BelongsTo
    {
        return $this->belongsTo(
            StatutoryRuleSet::class,
            'rule_set_id'
        );
    }
}
