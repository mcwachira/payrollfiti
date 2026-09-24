<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'subdomain',
        'default_country',
        'default_currency',
        'branding',
        'status',
        'trial_ends_at',
    ];

    protected $casts = [
        'branding' => 'array',
        'trial_ends_at' => 'datetime',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class, 'tenant_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'tenant_id');
    }
}
