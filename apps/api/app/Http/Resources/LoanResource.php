<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class LoanResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'company_id' => $this->company_id,
            'employee_id' => $this->employee_id,
            'loan_product_id' => $this->loan_product_id,
            'principal_amount' => $this->principal_amount,
            'interest_amount' => $this->interest_amount,
            'total_amount' => $this->total_amount,
            'outstanding_amount' => $this->outstanding_amount,
            'term_months' => $this->term_months,
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'status' => $this->status,
            'approved_at' => $this->approved_at,
            'approval_notes' => $this->approval_notes,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
