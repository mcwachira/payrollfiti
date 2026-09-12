<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payroll\Engine\CountryRuleSet;
use App\Domain\Payroll\Engine\PayrollCalculator;
use App\Domain\Payroll\Engine\PayrollInput;
use App\Domain\Payroll\Engine\RuleRegistry;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PayrollCalculatorController extends Controller
{
    public function __construct(
        private readonly RuleRegistry $registry,
        private readonly PayrollCalculator $calculator,
    ) {}

    public function countries(): JsonResponse
    {
        return response()->json([
            ['countryCode' => 'KE', 'currency' => 'KES', 'ruleVersion' => 'KE-2025'],
            ['countryCode' => 'NG', 'currency' => 'NGN', 'ruleVersion' => 'NG-2024'],
            ['countryCode' => 'ZA', 'currency' => 'ZAR', 'ruleVersion' => 'ZA-2024'],
        ]);
    }

    public function calculate(Request $request): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'country' => ['required', 'string', 'size:2'],
            'salary' => ['required', 'numeric', 'min:0'],
            'allowances' => ['sometimes', 'array'],
            'allowances.*' => ['numeric', 'min:0'],
            'deductions' => ['sometimes', 'array'],
            'deductions.*' => ['numeric', 'min:0'],
        ])->validate();

        $country = strtoupper($validated['country']);
        $currency = match ($country) {
            'NG' => 'NGN',
            'ZA' => 'ZAR',
            default => 'KES',
        };

        $ruleSet = $this->registry->resolve($country, new \DateTimeImmutable);

        $input = PayrollInput::fromLegacy(
            employeeId: 'calculator',
            countryCode: $country,
            currency: $currency,
            basicSalary: $validated['salary'],
            allowances: $validated['allowances'] ?? [],
            overtimeAmount: 0,
            commissionAmount: 0,
            bonusAmount: 0,
            voluntaryDeductions: $validated['deductions'] ?? [],
            periodStart: new \DateTimeImmutable,
            periodEnd: new \DateTimeImmutable,
        );

        $result = $this->calculator->calculate($input, $ruleSet);

        return response()->json([
            'countryCode' => $result->countryCode,
            'currency' => $result->currency,
            'ruleVersion' => $result->ruleVersion,
            'earnings' => [
                'basicSalary' => (float) $result->earnings->basicSalary,
                'totalAllowances' => (float) $result->earnings->totalAllowances,
                'overtimeAmount' => (float) $result->earnings->overtimeAmount,
                'commissionAmount' => (float) $result->earnings->commissionAmount,
                'bonusAmount' => (float) $result->earnings->bonusAmount,
                'grossPay' => (float) $result->earnings->grossPay,
                'allowanceBreakdown' => array_map(
                    fn ($v) => (float) $v,
                    $result->earnings->allowances
                ),
            ],
            'statutoryDeductions' => array_map(
                fn ($line) => [
                    'code' => $line->code,
                    'label' => $line->label,
                    'employeeAmount' => (float) $line->employeeAmount,
                    'employerAmount' => (float) $line->employerAmount,
                ],
                $result->statutoryDeductions
            ),
            'voluntaryDeductions' => array_map(
                fn ($v) => (float) $v,
                $result->voluntaryDeductions
            ),
            'totalVoluntaryDeductions' => (float) $result->totalVoluntaryDeductions,
            'tax' => [
                'code' => $result->tax->code,
                'taxableIncome' => (float) $result->tax->taxableIncome,
                'grossTax' => (float) $result->tax->grossTax,
                'relief' => (float) $result->tax->relief,
                'netTax' => (float) $result->tax->netTax,
            ],
            'totalDeductions' => (float) $result->totalDeductions,
            'grossPay' => (float) $result->grossPay,
            'netPay' => (float) $result->netPay,
            'validation' => array_map(
                fn ($issue) => [
                    'field' => $issue->field,
                    'message' => $issue->message,
                    'severity' => $issue->severity->value,
                ],
                $result->validation
            ),
        ]);
    }
}
