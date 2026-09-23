<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{

    // Docker bind mount test
    use HasFactory, HasUuids;

    protected $fillable = [
        'id',
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

    public function companies()
    {
        return $this->hasMany(Company::class, 'tenant_id');
    }

    public function users()
    {
        return $this->hasMany(User::class, 'tenant_id');
    }
}
