<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $tenant = Tenant::query()->where('id', $request->user()->tenant_id)->firstOrFail();

        return response()->json([
            'appName' => $tenant->name,
            'logoUrl' => $tenant->branding['logo_url'] ?? null,
            'primaryColor' => $tenant->branding['primary_color'] ?? null,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'appName' => ['sometimes', 'string', 'max:255'],
            'logoUrl' => ['sometimes', 'nullable', 'url'],
            'primaryColor' => ['sometimes', 'nullable', 'string', 'size:7'],
        ]);

        $tenant = Tenant::query()->where('id', $request->user()->tenant_id)->firstOrFail();

        $branding = $tenant->branding ?? [];

        if (isset($validated['appName'])) {
            $tenant->name = $validated['appName'];
        }

        if (array_key_exists('logoUrl', $validated)) {
            $branding['logo_url'] = $validated['logoUrl'];
        }

        if (array_key_exists('primaryColor', $validated)) {
            $branding['primary_color'] = $validated['primaryColor'];
        }

        $tenant->branding = $branding;
        $tenant->save();

        return response()->json([
            'appName' => $tenant->name,
            'logoUrl' => $branding['logo_url'] ?? null,
            'primaryColor' => $branding['primary_color'] ?? null,
        ]);
    }
}
