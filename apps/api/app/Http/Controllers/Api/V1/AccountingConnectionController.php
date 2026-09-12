<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreAccountingConnectionRequest;
use App\Http\Requests\Api\V1\UpdateAccountingConnectionRequest;
use App\Http\Resources\AccountingConnectionResource;
use App\Http\Resources\AccountingSyncJobResource;
use App\Models\AccountingConnection;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountingConnectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AccountingConnection::class);

        $query = AccountingConnection::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('company');

        if ($request->filled('provider')) {
            $query->where('provider', $request->input('provider'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $connections = $query->latest()->paginate($request->input('per_page', 15));

        return response()->json(
            AccountingConnectionResource::collection($connections)->resolve(),
        );
    }

    public function store(StoreAccountingConnectionRequest $request): JsonResponse
    {
        $data = $request->validated();

        $company = Company::query()
            ->where('id', $data['company_id'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $this->authorize('create', [AccountingConnection::class, $company]);

        $connection = AccountingConnection::create([
            'tenant_id' => $request->user()->tenant_id,
            'company_id' => $data['company_id'],
            'provider' => $data['provider'],
            'status' => $data['status'] ?? 'active',
            'metadata' => $data['metadata'] ?? [],
        ]);

        return (new AccountingConnectionResource($connection))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, AccountingConnection $accountingConnection): JsonResponse
    {
        $this->authorize('view', $accountingConnection);

        return (new AccountingConnectionResource($accountingConnection->load('company', 'syncJobs')))->response();
    }

    public function update(UpdateAccountingConnectionRequest $request, AccountingConnection $accountingConnection): JsonResponse
    {
        $this->authorize('update', $accountingConnection);

        $data = $request->validated();

        $accountingConnection->update($data);

        return (new AccountingConnectionResource($accountingConnection->load('company', 'syncJobs')))->response();
    }

    public function destroy(Request $request, AccountingConnection $accountingConnection): JsonResponse
    {
        $this->authorize('delete', $accountingConnection);

        $accountingConnection->update(['status' => 'disabled']);

        return response()->json(null, 204);
    }

    public function syncJobs(Request $request, AccountingConnection $accountingConnection): JsonResponse
    {
        $this->authorize('view', $accountingConnection);

        $jobs = $accountingConnection->syncJobs()
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 15));

        return response()->json(
            AccountingSyncJobResource::collection($jobs)->resolve(),
        );
    }
}
