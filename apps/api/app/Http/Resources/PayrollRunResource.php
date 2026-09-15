<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PayrollRunResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'company_id' => $this->company_id,
            'period_start' => $this->period_start,
            'period_end' => $this->period_end,
            'pay_date' => $this->pay_date,
            'status' => $this->status,
            'rule_version' => $this->rule_version,
            'input_hash' => $this->input_hash,
            'initiated_by' => $this->initiated_by,
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at,
            'finalized_by' => $this->finalized_by,
            'finalized_at' => $this->finalized_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'entries_count' => $this->entries()->count(),
        ];
    }
}
