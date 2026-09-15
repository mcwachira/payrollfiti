<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreApiKeyRequest;
use App\Http\Requests\Api\V1\UpdateApiKeyRequest;
use App\Http\Resources\ApiKeyResource;
use App\Models\ApiKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ApiKeyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ApiKey::class);

        $query = ApiKey::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('permissions');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%");
        }

        $apiKeys = $query->latest()->paginate($request->input('per_page', 15));

        return response()->json(
            ApiKeyResource::collection($apiKeys)->resolve(),
        );
    }

    public function store(StoreApiKeyRequest $request): JsonResponse
    {
        $this->authorize('create', ApiKey::class);

        $plainSecret = 'pf_'.Str::random(40);
        $prefix = 'pf_'.substr(hash('sha256', $plainSecret), 0, 8);

        $apiKey = ApiKey::create([
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'name' => $request->validated('name'),
            'prefix' => $prefix,
            'secret_hash' => Hash::make($plainSecret),
            'status' => 'active',
            'expires_at' => $request->validated('expires_at'),
        ]);

        if ($request->filled('permissions')) {
            foreach ($request->validated('permissions', []) as $permission) {
                $apiKey->permissions()->create([
                    'tenant_id' => $apiKey->tenant_id,
                    'permission' => $permission,
                ]);
            }
        }

        return (new ApiKeyResource($apiKey->load('permissions')))
            ->additional(['plain_secret' => $plainSecret])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, ApiKey $apiKey): JsonResponse
    {
        $this->authorize('view', $apiKey);

        return (new ApiKeyResource($apiKey->load('permissions')))->response();
    }

    public function update(UpdateApiKeyRequest $request, ApiKey $apiKey): JsonResponse
    {
        $this->authorize('update', $apiKey);

        $data = $request->validated();

        if (isset($data['expires_at'])) {
            $data['expires_at'] = $data['expires_at'] ?: null;
        }

        $apiKey->update($data);

        if (array_key_exists('permissions', $data)) {
            $apiKey->permissions()->delete();
            foreach ($data['permissions'] as $permission) {
                $apiKey->permissions()->create([
                    'tenant_id' => $apiKey->tenant_id,
                    'permission' => $permission,
                ]);
            }
        }

        return (new ApiKeyResource($apiKey->load('permissions')))->response();
    }

    public function destroy(Request $request, ApiKey $apiKey): JsonResponse
    {
        $this->authorize('delete', $apiKey);

        $apiKey->update(['status' => 'revoked', 'revoked_at' => now()]);

        return response()->json(null, 204);
    }

    public function regenerate(Request $request, ApiKey $apiKey): JsonResponse
    {
        $this->authorize('update', $apiKey);

        $plainSecret = 'pf_'.Str::random(40);

        $apiKey->update([
            'secret_hash' => Hash::make($plainSecret),
            'last_used_at' => null,
        ]);

        return response()->json([
            'plain_secret' => $plainSecret,
            'message' => 'API key secret regenerated. Store the new secret securely — it will not be shown again.',
        ]);
    }
}
