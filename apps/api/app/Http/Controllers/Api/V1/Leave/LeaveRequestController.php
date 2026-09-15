<?php

namespace App\Http\Controllers\Api\V1\Leave;

use App\Domain\Leave\Services\LeaveRequestService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Leave\ApproveLeaveRequest;
use App\Http\Requests\Api\V1\Leave\CancelLeaveRequest;
use App\Http\Requests\Api\V1\Leave\CreateLeaveRequest;
use App\Http\Requests\Api\V1\Leave\RejectLeaveRequest;
use App\Http\Resources\LeaveRequestResource;
use App\Models\LeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveRequestController extends Controller
{
    public function __construct(
        private readonly LeaveRequestService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', LeaveRequest::class);

        $query = LeaveRequest::query()
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }

        return LeaveRequestResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function store(CreateLeaveRequest $request): JsonResponse
    {
        $this->authorize('create', LeaveRequest::class);

        $data = $request->validated();
        $data['tenant_id'] = $request->user()->tenant_id;
        $data['submitted_by'] = $request->user()->id;
        $data['status'] = 'pending';

        $employee = \App\Models\Employee::query()
            ->where('tenant_id', $data['tenant_id'])
            ->whereKey($data['employee_id'])
            ->first();

        if ($employee) {
            $data['company_id'] = $employee->company_id;
        }

        $leaveRequest = LeaveRequest::create($data);

        $this->service->submit($leaveRequest);

        return (new LeaveRequestResource($leaveRequest))->response()->setStatusCode(201);
    }

    public function show(LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorize('view', $leaveRequest);

        return new LeaveRequestResource($leaveRequest);
    }

    public function approve(ApproveLeaveRequest $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorize('update', $leaveRequest);

        $this->service->approve($leaveRequest, $request->user(), $request->input('comments'));

        return new LeaveRequestResource($leaveRequest->fresh());
    }

    public function reject(RejectLeaveRequest $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorize('update', $leaveRequest);

        $this->service->reject($leaveRequest, $request->user(), $request->input('comments'));

        return new LeaveRequestResource($leaveRequest->fresh());
    }

    public function cancel(CancelLeaveRequest $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorize('update', $leaveRequest);

        $this->service->cancel($leaveRequest, $request->user(), $request->input('comments'));

        return new LeaveRequestResource($leaveRequest->fresh());
    }

    public function myRequests(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;

        if (!$employee) {
            return response()->json([]);
        }

        $query = LeaveRequest::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('employee_id', $employee->id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return LeaveRequestResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }
}
