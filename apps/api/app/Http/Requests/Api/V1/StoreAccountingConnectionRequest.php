<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreAccountingConnectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'provider' => ['required', 'string', 'in:xero,quickbooks,zoho_books'],
            'status' => ['sometimes', 'string', 'in:active,disabled'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
