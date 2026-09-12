<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = auth()->user();

        if (! $user instanceof \App\Models\User || $user->tenant_id === null) {
            return false;
        }

        $companyId = $this->input('company_id');

        if ($companyId === null) {
            return true;
        }

        return \App\Models\Company::query()
            ->where('id', $companyId)
            ->where('tenant_id', $user->tenant_id)
            ->exists();
    }

    public function rules(): array
    {
        return [
            'company_id' => ['sometimes', 'uuid', 'exists:companies,id'],
            'employee_number' => ['sometimes', 'string', 'max:255'],
            'first_name' => ['sometimes', 'string', 'max:255'],
            'middle_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'country' => ['sometimes', 'string', 'size:2'],
            'hire_date' => ['sometimes', 'date'],
            'termination_date' => ['sometimes', 'nullable', 'date'],
            'status' => ['sometimes', 'string', 'in:active,inactive,on_leave'],
            'salary_structure_id' => ['sometimes', 'nullable', 'uuid', 'exists:salary_structures,id'],
        ];
    }
}
