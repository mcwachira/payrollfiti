<?php

namespace App\Http\Requests\Api\V1\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class MarkHolidayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'uuid', 'exists:employees,id'],
            'attendance_date' => ['required', 'date'],
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'attendance_policy_id' => ['required', 'uuid', 'exists:attendance_policies,id'],
            'metadata' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
