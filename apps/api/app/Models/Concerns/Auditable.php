<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function (Model $model) {
            if (! $model->shouldAudit()) {
                return;
            }

            AuditLog::create([
                'tenant_id' => $model->tenant_id ?? app('tenant.context')->current(),
                'user_id' => Auth::id(),
                'action' => 'created',
                'auditable_type' => $model->getMorphClass(),
                'auditable_id' => $model->getKey(),
                'new_values' => $model->getAttributes(),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent()?->raw(),
            ]);
        });

        static::updated(function (Model $model) {
            if (! $model->shouldAudit()) {
                return;
            }

            AuditLog::create([
                'tenant_id' => $model->tenant_id ?? app('tenant.context')->current(),
                'user_id' => Auth::id(),
                'action' => 'updated',
                'auditable_type' => $model->getMorphClass(),
                'auditable_id' => $model->getKey(),
                'old_values' => $model->getOriginal(),
                'new_values' => $model->getAttributes(),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent()?->raw(),
            ]);
        });

        static::deleted(function (Model $model) {
            if (! $model->shouldAudit()) {
                return;
            }

            AuditLog::create([
                'tenant_id' => $model->tenant_id ?? app('tenant.context')->current(),
                'user_id' => Auth::id(),
                'action' => 'deleted',
                'auditable_type' => $model->getMorphClass(),
                'auditable_id' => $model->getKey(),
                'old_values' => $model->getOriginal(),
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent()?->raw(),
            ]);
        });
    }

    public function shouldAudit(): bool
    {
        return true;
    }
}
