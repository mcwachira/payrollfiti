<?php

namespace App\Domain\Compliance;

use App\Domain\Compliance\Events\ComplianceReportGenerated;
use App\Models\ComplianceReport;
use App\Models\PayrollRun;
use Illuminate\Support\Carbon;

final class ComplianceReportService
{
    public function __construct(
        private readonly CountryComplianceRegistry $registry,
    ) {}

    public function generateForPayrollRun(PayrollRun $payrollRun, ?string $reportCode = null): ComplianceReport
    {
        $company = $payrollRun->company()->firstOrFail();
        $countryCode = strtoupper($company->country ?? 'KE');
        $generator = $this->registry->resolve($countryCode, $reportCode);
        $payload = $generator->generate($payrollRun);

        $attributes = [
            'tenant_id' => $payrollRun->tenant_id,
            'company_id' => $company->id,
            'payroll_run_id' => $payrollRun->id,
            'country' => $countryCode,
            'report_code' => $payload['report_code'],
            'report_version' => $payload['report_version'],
            'status' => 'generated',
            'generated_at' => Carbon::now(),
            'rows' => $payload['rows'],
            'totals' => $payload['totals'],
            'metadata' => $payload['metadata'],
        ];

        $report = ComplianceReport::query()
            ->where('tenant_id', $payrollRun->tenant_id)
            ->where('company_id', $company->id)
            ->where('payroll_run_id', $payrollRun->id)
            ->where('report_code', $payload['report_code'])
            ->where('report_version', $payload['report_version'])
            ->first();

        if ($report !== null) {
            $report->fill($attributes);
            $report->save();

            return $report;
        }

        $report = ComplianceReport::create($attributes);

        if ($report->exists) {
            ComplianceReportGenerated::dispatch(
                $report->tenant_id,
                $report->id,
                $payrollRun->initiated_by,
            );
        }

        return $report;
    }
}
