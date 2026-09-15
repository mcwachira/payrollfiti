<?php

namespace App\Models\Concerns;

use App\Models\Scopes\TenantScope;
use App\Models\Tenant;

trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function ($model): void {
            if (empty($model->tenant_id) && app()->bound('tenant.context')) {
                $tenantId = app('tenant.context')->current();

                if ($tenantId !== null) {
                    $model->tenant_id = $tenantId;
                }
            }
        });
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function scopeForTenant($query, ?string $tenantId = null)
    {
        $tenantId ??= app()->bound('tenant.context') ? app('tenant.context')->current() : null;

        if ($tenantId === null) {
            return $query;
        }

        return $query->where('tenant_id', $tenantId);
    }

    public function scopeWithoutTenantScope($query)
    {
        return $query->withoutGlobalScope(TenantScope::class);
    }
}
