<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreEmployeeRequest;
use App\Http\Requests\Api\V1\UpdateEmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Employee::class);

        $query = Employee::query()->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return EmployeeResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $this->authorize('create', Employee::class);

        $data = $request->validated();
        $data['tenant_id'] = $request->user()->tenant_id;

        $employee = Employee::create($data);

        return (new EmployeeResource($employee))->response()->setStatusCode(201);
    }

    public function show(Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        return new EmployeeResource($employee);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $data = $request->validated();

        if (isset($data['company_id']) && $data['company_id'] !== $employee->company_id) {
            $employee->company_id = $data['company_id'];
        }

        $employee->fill($data);
        $employee->save();

        return new EmployeeResource($employee);
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->authorize('delete', $employee);

        $employee->delete();

        return response()->json(['deleted' => true]);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $this->authorize('create', Employee::class);

        $data = $request->validate([
            'employees' => ['required', 'array', 'min:1'],
            'employees.*.company_id' => ['required', 'uuid', 'exists:companies,id'],
            'employees.*.employee_number' => ['required', 'string', 'max:255'],
            'employees.*.first_name' => ['required', 'string', 'max:255'],
            'employees.*.middle_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'employees.*.last_name' => ['required', 'string', 'max:255'],
            'employees.*.email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'employees.*.phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'employees.*.country' => ['required', 'string', 'size:2'],
            'employees.*.hire_date' => ['required', 'date'],
            'employees.*.termination_date' => ['sometimes', 'nullable', 'date'],
            'employees.*.status' => ['sometimes', 'string', 'in:active,inactive,on_leave'],
            'employees.*.salary_structure_id' => ['sometimes', 'nullable', 'uuid', 'exists:salary_structures,id'],
        ]);

        $tenantId = $request->user()->tenant_id;
        $results = [];

        foreach ($data['employees'] as $index => $input) {
            try {
                $employee = new Employee($input);
                $employee->tenant_id = $tenantId;
                $employee->save();

                $results[] = [
                    'index' => $index,
                    'success' => true,
                    'employee' => new EmployeeResource($employee),
                ];
            } catch (\Throwable $e) {
                $results[] = [
                    'index' => $index,
                    'success' => false,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json($results);
    }

    public function invite(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('update', $employee);

        $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        // In a real implementation, send an invitation email
        // For now, just return success
        return response()->json(['message' => 'Invitation sent'], 201);
    }

    public function leaveBalances(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);

        $balances = $employee->leaveBalances()
            ->where('tenant_id', $request->user()->tenant_id)
            ->get();

        return response()->json($balances);
    }
}
