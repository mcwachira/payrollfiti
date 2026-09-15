<?php

namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Http\Resources\LeaveTypeResource;
use App\Models\LeaveType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', LeaveType::class);

        $query = LeaveType::query()->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return LeaveTypeResource::collection($query->get());
    }
}
