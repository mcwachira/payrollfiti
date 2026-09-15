<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ComplianceReportResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'company_id' => $this->company_id,
            'payroll_run_id' => $this->payroll_run_id,
            'country' => $this->country,
            'report_code' => $this->report_code,
            'report_version' => $this->report_version,
            'status' => $this->status,
            'generated_at' => $this->generated_at?->toISOString(),
            'rows' => $this->rows,
            'totals' => $this->totals,
            'metadata' => $this->metadata,
        ];
    }
}
