<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;

class SetCurrentTenantContext
{
    public function handle(Request $request, Closure $next)
    {
        $tenantId = TenantContext::resolveFromRequest($request);

        if ($tenantId !== null) {
            TenantContext::set($tenantId);
        }

        try {
            return $next($request);
        } finally {
            TenantContext::clear();
        }
    }
}
