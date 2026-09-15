<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreWebhookEndpointRequest;
use App\Http\Requests\Api\V1\UpdateWebhookEndpointRequest;
use App\Http\Resources\WebhookEndpointResource;
use App\Models\WebhookEndpoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class WebhookEndpointController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', WebhookEndpoint::class);

        $query = WebhookEndpoint::query()
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $endpoints = $query->latest()->paginate($request->input('per_page', 15));

        return response()->json(
            WebhookEndpointResource::collection($endpoints)->resolve(),
        );
    }

    public function store(StoreWebhookEndpointRequest $request): JsonResponse
    {
        $this->authorize('create', WebhookEndpoint::class);

        $data = $request->validated();

        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $data['name'],
            'url' => $data['url'],
            'secret_hash' => isset($data['secret']) ? Hash::make($data['secret']) : null,
            'events' => $data['events'],
            'status' => $data['status'] ?? 'active',
        ]);

        return (new WebhookEndpointResource($endpoint))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, WebhookEndpoint $webhookEndpoint): JsonResponse
    {
        $this->authorize('view', $webhookEndpoint);

        return (new WebhookEndpointResource($webhookEndpoint))->response();
    }

    public function update(UpdateWebhookEndpointRequest $request, WebhookEndpoint $webhookEndpoint): JsonResponse
    {
        $this->authorize('update', $webhookEndpoint);

        $data = $request->validated();

        if (isset($data['secret']) && $data['secret'] !== null) {
            $data['secret_hash'] = Hash::make($data['secret']);
            unset($data['secret']);
        }

        $webhookEndpoint->update($data);

        return (new WebhookEndpointResource($webhookEndpoint))->response();
    }

    public function destroy(Request $request, WebhookEndpoint $webhookEndpoint): JsonResponse
    {
        $this->authorize('delete', $webhookEndpoint);

        $webhookEndpoint->update(['status' => 'disabled']);

        return response()->json(null, 204);
    }

    public function deliveryLogs(Request $request, WebhookEndpoint $webhookEndpoint): JsonResponse
    {
        $this->authorize('view', $webhookEndpoint);

        $logs = $webhookEndpoint->deliveryLogs()
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 15));

        return response()->json(
            WebhookEndpointResource::deliveryLogsCollection($logs)->resolve(),
        );
    }
}
