<?php

namespace App\Http\Requests\Api\V1;

use App\Models\Company;
use Illuminate\Foundation\Http\FormRequest;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $companyId = $this->input('company_id');

        if (! $companyId) {
            return false;
        }

        $company = Company::query()->where('id', $companyId)->first();

        return $company !== null && $company->tenant_id === $this->user()?->tenant_id;
    }

    public function rules(): array
    {
        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'employee_number' => ['required', 'string', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country' => ['required', 'string', 'size:2'],
            'hire_date' => ['required', 'date'],
            'termination_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'string', 'in:active,inactive,on_leave'],
            'salary_structure_id' => ['sometimes', 'nullable', 'uuid', 'exists:salary_structures,id'],
        ];
    }
}
