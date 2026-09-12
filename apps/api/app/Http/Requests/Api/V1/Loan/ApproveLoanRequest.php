<?php

namespace App\Http\Requests\Api\V1\Loan;

use Illuminate\Foundation\Http\FormRequest;

class ApproveLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
