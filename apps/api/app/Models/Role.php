<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use BelongsToTenant, HasUuids;

    protected $fillable = [
        'name',
        'guard_name',
        'slug',
        'description',
    ];

    public $incrementing = false;

    protected $keyType = 'string';
}
