<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Compliance\ComplianceReportService;
use App\Http\Controllers\Controller;
use App\Http\Resources\ComplianceReportResource;
use App\Models\ComplianceReport;
use App\Models\PayrollRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComplianceReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ComplianceReport::class);

        $query = ComplianceReport::query()->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }

        if ($request->filled('country')) {
            $query->where('country', strtoupper($request->input('country')));
        }

        return ComplianceReportResource::collection($query->latest('generated_at')->paginate($request->input('per_page', 15)));
    }

    public function show(ComplianceReport $complianceReport): JsonResponse
    {
        $this->authorize('view', $complianceReport);

        return response()->json(new ComplianceReportResource($complianceReport->load('company', 'payrollRun')));
    }

    public function store(Request $request, ComplianceReportService $service): JsonResponse
    {
        $this->authorize('create', ComplianceReport::class);

        $request->validate([
            'payroll_run_id' => ['required', 'uuid', 'exists:payroll_runs,id'],
            'report_code' => ['nullable', 'string'],
        ]);

        $payrollRun = PayrollRun::query()->whereKey($request->input('payroll_run_id'))->firstOrFail();
        $this->authorize('view', $payrollRun);

        try {
            $report = $service->generateForPayrollRun($payrollRun, $request->input('report_code'));
        } catch (\Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return (new ComplianceReportResource($report))->response()->setStatusCode(201);
    }

    public function generateForPayrollRun(PayrollRun $payrollRun, ComplianceReportService $service): JsonResponse
    {
        $this->authorize('view', $payrollRun);

        try {
            $report = $service->generateForPayrollRun($payrollRun);
        } catch (\Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return (new ComplianceReportResource($report))->response()->setStatusCode(201);
    }

    public function downloadP10(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'p10')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "p10-{$period}.csv");
    }

    public function downloadNssfRemittance(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'nssf_remittance')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "nssf-remittance-{$period}.csv");
    }

    public function downloadNhifRemittance(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'nhif_remittance')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "nhif-shif-remittance-{$period}.csv");
    }

    public function downloadP9(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $employeeId = $request->query('employeeId');
        $taxYear = $request->query('taxYear');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'p9')
            ->where('payload->employee_id', $employeeId)
            ->where('payload->tax_year', $taxYear)
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "p9-{$employeeId}-{$taxYear}.pdf");
    }

    public function downloadPayeRemittance(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'paye_remittance')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "paye-remittance-{$period}.csv");
    }

    public function downloadPensionRemittance(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'pension_remittance')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "pension-remittance-{$period}.csv");
    }

    public function downloadNhfRemittance(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'nhf_remittance')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "nhf-remittance-{$period}.csv");
    }

    public function downloadEmp201(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $period = $request->query('period');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'emp201')
            ->when($period, function ($q, $period) {
                $q->where('period', $period);
            })
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "emp201-{$period}.csv");
    }

    public function downloadIrp5(Request $request, $companyId): \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $employeeId = $request->query('employeeId');
        $taxYear = $request->query('taxYear');
        $report = ComplianceReport::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('company_id', $companyId)
            ->where('report_code', 'irp5')
            ->where('payload->employee_id', $employeeId)
            ->where('payload->tax_year', $taxYear)
            ->latest('generated_at')
            ->first();

        if (!$report || !$report->file_path) {
            return response()->json(['message' => 'Report not found'], 404);
        }

        return response()->download($report->file_path, "irp5-{$employeeId}-{$taxYear}.pdf");
    }
}
