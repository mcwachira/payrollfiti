<?php

namespace App\Http\Requests\Api\V1\Leave;

use Illuminate\Foundation\Http\FormRequest;

class RejectLeaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'comments' => ['required', 'string', 'max:1000'],
        ];
    }
}
