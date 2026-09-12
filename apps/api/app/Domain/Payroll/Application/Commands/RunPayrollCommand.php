<?php

namespace App\Domain\Payroll\Application\Commands;

use App\Domain\Payroll\Engine\Money;
use App\Domain\Payroll\Engine\PayrollCalculator;
use App\Domain\Payroll\Engine\PayrollInput;
use App\Domain\Payroll\Engine\RuleRegistry;
use App\Models\Company;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDOException;

final class RunPayrollCommand
{
    public function __construct(
        private readonly RuleRegistry $registry,
        private readonly PayrollCalculator $calculator,
    ) {}

    public function handle(Company $company, CarbonImmutable $periodStart, CarbonImmutable $periodEnd, User $initiator, array $employeeEntries = []): PayrollRun
    {
        $ruleSet = $this->registry->resolve($company->country ?? 'KE', $periodStart->toDateTimeImmutable());

        $employeeQuery = Employee::query()
            ->where('tenant_id', $company->tenant_id)
            ->where('company_id', $company->id)
            ->where('status', 'active');

        if ($employeeEntries !== []) {
            $employeeIds = array_map(fn ($entry) => $entry['employee_id'], $employeeEntries);
            $employeeQuery->whereIn('id', $employeeIds);
        }

        $employees = $employeeQuery->get();

        $results = [];
        foreach ($employees as $employee) {
            $entry = collect($employeeEntries)->firstWhere('employee_id', $employee->id) ?? [
                'basic_salary' => 0,
                'allowances' => [],
                'voluntary_deductions' => [],
            ];

            // Convert all monetary values to decimal strings
            // If values are already strings (from API), use them directly
            // If values are numeric, convert to decimal strings
            $basicSalary = is_numeric($entry['basic_salary'] ?? 0)
                ? Money::toDecimal($entry['basic_salary'] ?? 0)
                : (string) ($entry['basic_salary'] ?? '0');

            $allowances = [];
            if (is_array($entry['allowances'] ?? null)) {
                foreach ($entry['allowances'] as $key => $value) {
                    $allowances[$key] = is_numeric($value) ? Money::toDecimal($value) : (string) $value;
                }
            }

            $voluntaryDeductions = [];
            if (is_array($entry['voluntary_deductions'] ?? null)) {
                foreach ($entry['voluntary_deductions'] as $key => $value) {
                    $voluntaryDeductions[$key] = is_numeric($value) ? Money::toDecimal($value) : (string) $value;
                }
            }

            $input = new PayrollInput(
                employeeId: $employee->id,
                countryCode: strtoupper($company->country ?? $employee->country ?? 'KE'),
                currency: $company->currency ?? 'KES',
                basicSalary: $basicSalary,
                allowances: $allowances,
                overtimeAmount: '0',
                commissionAmount: '0',
                bonusAmount: '0',
                voluntaryDeductions: $voluntaryDeductions,
                periodStart: $periodStart->toDateTimeImmutable(),
                periodEnd: $periodEnd->toDateTimeImmutable(),
                employmentStartDate: $employee->hire_date ? new \DateTimeImmutable($employee->hire_date) : null,
                employmentEndDate: $employee->termination_date ? new \DateTimeImmutable($employee->termination_date) : null,
            );

            $result = $this->calculator->calculate($input, $ruleSet);
            $results[] = ['employee' => $employee, 'result' => $result];
        }

        $hashPayload = array_values(array_map(fn ($row) => $row['result']->inputHash, $results));
        $inputHash = hash('sha256', Money::stableJson(['company_id' => $company->id, 'period_start' => $periodStart->toDateString(), 'period_end' => $periodEnd->toDateString(), 'employees' => $hashPayload]));

        return DB::transaction(function () use ($company, $periodStart, $periodEnd, $initiator, $inputHash, $ruleSet, $results) {
            try {
                $run = PayrollRun::create([
                    'tenant_id' => $company->tenant_id,
                    'company_id' => $company->id,
                    'payroll_period_id' => null,
                    'status' => 'draft',
                    'period_start' => $periodStart->toDateString(),
                    'period_end' => $periodEnd->toDateString(),
                    'pay_date' => now()->toDateString(),
                    'input_hash' => $inputHash,
                    'rule_version' => $ruleSet->version(),
                    'initiated_by' => $initiator->id,
                    'input_snapshot' => ['results' => array_map(fn ($row) => ['employee_id' => $row['employee']->id, 'inputHash' => $row['result']->inputHash], $results)],
                ]);
            } catch (PDOException $exception) {
                $run = PayrollRun::query()
                    ->where('tenant_id', $company->tenant_id)
                    ->where('company_id', $company->id)
                    ->where('input_hash', $inputHash)
                    ->firstOrFail();

                return $run;
            }

            foreach ($results as $row) {
                // Calculate taxable pay: gross_pay - sum of employee statutory deductions
                $totalEmployeeStatutory = Money::sum(
                    array_map(fn ($line) => $line->employeeAmount, $row['result']->statutoryDeductions)
                );
                $taxablePay = Money::round2(
                    Money::sub($row['result']->grossPay, $totalEmployeeStatutory)
                );

                // Ensure taxable pay is not negative
                if (Money::cmp($taxablePay, '0') < 0) {
                    $taxablePay = '0';
                }

                // Calculate employer contributions
                $employerContributions = Money::round2(array_reduce(
                    $row['result']->statutoryDeductions,
                    fn ($total, $line) => Money::add($total, $line->employerAmount),
                    '0',
                ));

                $row['employee']->payrollEntries()->create([
                    'id' => Str::uuid(),
                    'tenant_id' => $company->tenant_id,
                    'payroll_run_id' => $run->id,
                    'employee_id' => $row['employee']->id,
                    'gross_pay' => $row['result']->grossPay,
                    'taxable_pay' => $taxablePay,
                    'total_deductions' => $row['result']->totalDeductions,
                    'employer_contributions' => $employerContributions,
                    'net_pay' => $row['result']->netPay,
                    'breakdown' => json_encode($row['result']),
                    'created_at' => now(),
                ]);
            }

            return $run;
        });
    }
}
