<?php

namespace App\Domain\Compliance\Generators;

use App\Domain\Compliance\CountryComplianceGenerator;
use App\Models\PayrollEntry;
use App\Models\PayrollRun;
use Illuminate\Support\Collection;

abstract class AbstractCountryComplianceGenerator implements CountryComplianceGenerator
{
    abstract public function countryCode(): string;

    abstract public function reportCode(): string;

    abstract public function version(): string;

    public function generate(PayrollRun $payrollRun): array
    {
        $entries = $payrollRun->entries()->with('employee')->get();

        $rows = $entries->map(fn (PayrollEntry $entry) => [
            'employee_id' => $entry->employee_id,
            'employee_number' => $entry->employee?->employee_number,
            'display_name' => trim(($entry->employee?->first_name ?? '').' '.($entry->employee?->last_name ?? '')),
            'gross_pay' => (float) $entry->gross_pay,
            'taxable_pay' => (float) $entry->taxable_pay,
            'total_deductions' => (float) $entry->total_deductions,
            'employer_contributions' => (float) $entry->employer_contributions,
            'net_pay' => (float) $entry->net_pay,
        ])->values()->all();

        return [
            'report_code' => $this->reportCode(),
            'report_version' => $this->version(),
            'country' => $this->countryCode(),
            'rows' => $rows,
            'totals' => $this->totalsFor($entries),
            'metadata' => [
                'template' => $this->reportCode(),
                'source' => 'persisted_payroll_entries',
                'source_payroll_run_id' => $payrollRun->id,
                'country' => $this->countryCode(),
                'period_start' => $payrollRun->period_start,
                'period_end' => $payrollRun->period_end,
                'rule_version' => $payrollRun->rule_version,
            ],
        ];
    }

    protected function totalsFor(Collection $entries): array
    {
        return [
            'gross_pay' => (float) $entries->sum('gross_pay'),
            'taxable_pay' => (float) $entries->sum('taxable_pay'),
            'total_deductions' => (float) $entries->sum('total_deductions'),
            'employer_contributions' => (float) $entries->sum('employer_contributions'),
            'net_pay' => (float) $entries->sum('net_pay'),
            'employees' => $entries->count(),
        ];
    }
}
