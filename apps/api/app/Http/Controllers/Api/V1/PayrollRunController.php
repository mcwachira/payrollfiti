<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payroll\Application\Commands\RunPayrollCommand;
use App\Domain\Payroll\Application\FinalizePayrollRun;
use App\Domain\Payroll\Engine\PayrollCalculator;
use App\Domain\Payroll\Engine\RuleRegistry;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\RunPayrollRequest;
use App\Http\Resources\PayrollRunResource;
use App\Models\Company;
use App\Models\PayrollRun;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollRunController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', PayrollRun::class);

        $query = PayrollRun::query()->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }

        return PayrollRunResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function show(PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('view', $payrollRun);

        return new PayrollRunResource($payrollRun->load('entries'));
    }

    public function store(RunPayrollRequest $request, RuleRegistry $registry): JsonResponse
    {
        $company = Company::query()->where('id', $request->input('company_id'))->firstOrFail();
        $this->authorize('run', $company);

        $command = new RunPayrollCommand($registry, app(PayrollCalculator::class));
        $run = $command->handle(
            $company,
            CarbonImmutable::parse($request->input('period_start')),
            CarbonImmutable::parse($request->input('period_end')),
            $request->user(),
            $request->input('employee_entries', []),
        );

        return (new PayrollRunResource($run))->response()->setStatusCode(201);
    }

    public function approve(PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('approve', $payrollRun);

        $payrollRun = DB::transaction(function () use ($payrollRun): PayrollRun {
            $fresh = PayrollRun::withoutTenantScope()
                ->whereKey($payrollRun->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($fresh->status !== 'draft') {
                throw new \RuntimeException("Cannot approve payroll run in status [{$fresh->status}].");
            }

            $fresh->forceFill([
                'status' => 'approved',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ])->save();

            return $fresh;
        });

        return new PayrollRunResource($payrollRun);
    }

    public function finalize(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->authorize('finalize', $payrollRun);

        $payrollRun = (new FinalizePayrollRun)->handle($payrollRun, $request->user());

        return new PayrollRunResource($payrollRun);
    }

    public function myRuns(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;

        if (!$employee) {
            return response()->json([]);
        }

        $query = PayrollRun::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereHas('entries', function ($q) use ($employee) {
                $q->where('employee_id', $employee->id);
            });

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }

        return PayrollRunResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function downloadPayslip(PayrollRun $payrollRun): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $this->authorize('view', $payrollRun);

        $employee = auth()->user()->employee;

        if (!$employee) {
            return response()->json(['message' => 'No employee record'], 404);
        }

        $entry = $payrollRun->entries()
            ->where('employee_id', $employee->id)
            ->first();

        if (!$entry || !$entry->payslip_path) {
            return response()->json(['message' => 'Payslip not found'], 404);
        }

        return response()->download($entry->payslip_path, "payslip-{$payrollRun->id}.pdf");
    }

    public function downloadBankExport(PayrollRun $payrollRun): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $this->authorize('view', $payrollRun);

        if (!$payrollRun->bank_export_path) {
            return response()->json(['message' => 'Bank export not available'], 404);
        }

        return response()->download($payrollRun->bank_export_path, "bank-export-{$payrollRun->id}.csv");
    }
}
