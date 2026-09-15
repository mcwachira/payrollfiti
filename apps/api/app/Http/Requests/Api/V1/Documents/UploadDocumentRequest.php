<?php

namespace App\Http\Requests\Api\V1\Documents;

use Illuminate\Foundation\Http\FormRequest;

class UploadDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'uuid', 'exists:employees,id'],
            'document_type_id' => ['required', 'uuid', 'exists:document_types,id'],
            'document' => ['required', 'file', 'max:10240'],
            'metadata' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
