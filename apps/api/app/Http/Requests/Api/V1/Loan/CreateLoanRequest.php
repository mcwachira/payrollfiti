<?php

namespace App\Http\Requests\Api\V1\Loan;

use Illuminate\Foundation\Http\FormRequest;

class CreateLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'uuid', 'exists:employees,id'],
            'loan_product_id' => ['required', 'uuid', 'exists:loan_products,id'],
            'principal_amount' => ['required', 'numeric', 'min:0.01'],
            'term_months' => ['required', 'integer', 'min:1'],
        ];
    }
}
