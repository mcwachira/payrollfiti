<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'company_id' => $this->company_id,
            'employee_number' => $this->employee_number,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => trim("{$this->first_name} {$this->middle_name} {$this->last_name}"),
            'email' => $this->email,
            'phone' => $this->phone,
            'country' => $this->country,
            'status' => $this->status,
            'hire_date' => $this->hire_date,
            'termination_date' => $this->termination_date,
            'salary_structure_id' => $this->salary_structure_id,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
