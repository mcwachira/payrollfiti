<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Company;
use Illuminate\Foundation\Http\FormRequest;

class RunPayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        $companyId = $this->input('company_id');

        if (! $companyId) {
            return false;
        }

        $company = Company::query()->where('id', $companyId)->first();

        return $company !== null && $this->user()?->tenant_id === $company->tenant_id && $this->user()?->can('run', $company);
    }

    public function rules(): array
    {
        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'pay_date' => ['required', 'date'],
            'employee_entries' => ['sometimes', 'array'],
            'employee_entries.*.employee_id' => ['required_with:employee_entries', 'uuid', 'exists:employees,id'],
            'employee_entries.*.basic_salary' => ['required_with:employee_entries', 'numeric', 'min:0'],
            'employee_entries.*.allowances' => ['sometimes', 'array'],
            'employee_entries.*.voluntary_deductions' => ['sometimes', 'array'],
        ];
    }
}
