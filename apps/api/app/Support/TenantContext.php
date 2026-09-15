<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TenantContext
{
    protected static ?string $tenantId = null;

    public static function set(?string $tenantId): void
    {
        static::$tenantId = $tenantId;

        if ($tenantId === null) {
            static::clearDatabaseContext();

            return;
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("SELECT set_config('app.current_tenant_id', ?, false)", [$tenantId]);
        }
    }

    public static function clear(): void
    {
        static::$tenantId = null;
        static::clearDatabaseContext();
    }

    public static function current(): ?string
    {
        if (static::$tenantId !== null) {
            return static::$tenantId;
        }

        $request = request();
        $user = $request?->user() ?? Auth::user();

        return $user?->tenant_id ?: null;
    }

    public static function resolveFromRequest(Request $request): ?string
    {
        $tenantHeader = $request->header('X-Tenant-ID');
        $userTenantId = $request->user()?->tenant_id ?? $request->user('sanctum')?->tenant_id;

        if ($tenantHeader !== null && $tenantHeader !== '' && $userTenantId !== null && $tenantHeader !== $userTenantId) {
            abort(403, 'Tenant mismatch.');
        }

        return $userTenantId ?: null;
    }

    protected static function clearDatabaseContext(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        try {
            DB::statement('RESET app.current_tenant_id');
        } catch (\Throwable $e) {
            // The connection may not support the app.current_tenant_id setting.
        }
    }
}
