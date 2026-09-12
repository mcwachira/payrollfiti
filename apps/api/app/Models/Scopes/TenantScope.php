<?php

namespace App\Models\Scopes;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (! $this->isTenantScopedModel($model)) {
            return;
        }

        $tenantId = TenantContext::current();

        if ($tenantId === null) {
            return;
        }

        $builder->where($model->qualifyColumn('tenant_id'), $tenantId);
    }

    protected function isTenantScopedModel(Model $model): bool
    {
        $table = $model->getTable();
        $connection = $model->getConnection();

        try {
            if (! $connection->getSchemaBuilder()->hasTable($table)) {
                return false;
            }

            return $connection->getSchemaBuilder()->hasColumn($table, 'tenant_id');
        } catch (\Throwable $e) {
            return false;
        }
    }
}
