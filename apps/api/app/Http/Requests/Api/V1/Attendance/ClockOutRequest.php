<?php

namespace App\Http\Requests\Api\V1\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class ClockOutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'regular_hours' => ['sometimes', 'nullable', 'numeric'],
            'overtime_hours' => ['sometimes', 'nullable', 'numeric'],
            'status' => ['sometimes', 'string', 'in:present,absent,leave,holiday,partial'],
            'metadata' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
