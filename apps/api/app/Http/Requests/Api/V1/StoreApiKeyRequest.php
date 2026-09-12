<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreApiKeyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'permissions' => ['sometimes', 'array', 'max:50'],
            'permissions.*' => ['required', 'string', 'max:255'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
