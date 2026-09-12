<?php

namespace App\Http\Controllers\Api\V1\Attendance;

use App\Domain\Attendance\Services\AttendanceService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Attendance\ClockInRequest;
use App\Http\Requests\Api\V1\Attendance\ClockOutRequest;
use App\Http\Requests\Api\V1\Attendance\MarkAbsentRequest;
use App\Http\Requests\Api\V1\Attendance\MarkHolidayRequest;
use App\Http\Resources\AttendanceRecordResource;
use App\Models\AttendanceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly AttendanceService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AttendanceRecord::class);

        $query = AttendanceRecord::query()
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('attendance_date', [$request->input('from'), $request->input('to')]);
        }

        return AttendanceRecordResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function clockIn(ClockInRequest $request): JsonResponse
    {
        $this->authorize('create', AttendanceRecord::class);

        $record = $this->service->clockIn(
            $request->input('employee_id'),
            $request->input('attendance_policy_id'),
            $request->validated()
        );

        return (new AttendanceRecordResource($record))->response()->setStatusCode(201);
    }

    public function clockOut(ClockOutRequest $request, AttendanceRecord $record): JsonResponse
    {
        $this->authorize('update', $record);

        $updated = $this->service->clockOut($record->id, $request->validated());

        return new AttendanceRecordResource($updated);
    }

    public function markHoliday(MarkHolidayRequest $request): JsonResponse
    {
        $this->authorize('create', AttendanceRecord::class);

        $record = $this->service->markHoliday(
            $request->input('employee_id'),
            $request->input('attendance_date'),
            $request->validated()
        );

        return (new AttendanceRecordResource($record))->response()->setStatusCode(201);
    }

    public function markAbsent(MarkAbsentRequest $request): JsonResponse
    {
        $this->authorize('create', AttendanceRecord::class);

        $record = $this->service->markAbsent(
            $request->input('employee_id'),
            $request->input('attendance_date'),
            $request->validated()
        );

        return (new AttendanceRecordResource($record))->response()->setStatusCode(201);
    }

    public function show(AttendanceRecord $record): JsonResponse
    {
        $this->authorize('view', $record);

        return new AttendanceRecordResource($record);
    }
}
