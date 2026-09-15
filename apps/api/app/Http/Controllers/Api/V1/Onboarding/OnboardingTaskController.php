<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Onboarding;

use App\Domain\Onboarding\Services\OnboardingTaskService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Onboarding\CreateOnboardingTaskRequest;
use App\Http\Requests\Api\V1\Onboarding\UpdateOnboardingTaskRequest;
use App\Http\Resources\OnboardingTaskResource;
use App\Models\OnboardingTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnboardingTaskController extends Controller
{
    public function __construct(
        private readonly OnboardingTaskService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', OnboardingTask::class);

        $query = OnboardingTask::query()
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return OnboardingTaskResource::collection($query->latest()->paginate($request->input('per_page', 15)))->response();
    }

    public function store(CreateOnboardingTaskRequest $request): JsonResponse
    {
        $this->authorize('create', OnboardingTask::class);

        $data = $request->validated();
        $data['tenant_id'] = $request->user()->tenant_id;

        $employee = \App\Models\Employee::query()
            ->where('tenant_id', $data['tenant_id'])
            ->whereKey($data['employee_id'])
            ->first();

        if ($employee) {
            $data['company_id'] = $employee->company_id;
        }

        $task = OnboardingTask::create($data);

        return (new OnboardingTaskResource($task))->response()->setStatusCode(201);
    }

    public function show(OnboardingTask $task): JsonResponse
    {
        $this->authorize('view', $task);

        return (new OnboardingTaskResource($task))->response();
    }

    public function update(UpdateOnboardingTaskRequest $request, OnboardingTask $task): JsonResponse
    {
        $this->authorize('update', $task);

        $task->update([
            'status' => $request->input('status'),
            'completed_at' => $request->input('status') === 'completed' ? now() : null,
        ]);

        return (new OnboardingTaskResource($task->fresh()))->response();
    }

    public function destroy(OnboardingTask $task): JsonResponse
    {
        $this->authorize('update', $task);

        $task->delete();

        return response()->json(['message' => 'Task deleted']);
    }
}
