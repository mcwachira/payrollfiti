<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreWebhookEndpointRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'url' => ['required', 'url', 'max:2048'],
            'secret' => ['sometimes', 'nullable', 'string', 'max:255'],
            'events' => ['required', 'array', 'min:1', 'max:50'],
            'events.*' => ['required', 'string', 'max:255'],
            'status' => ['sometimes', 'string', 'in:active,disabled'],
        ];
    }
}
