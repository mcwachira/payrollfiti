<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceRecordResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'company_id' => $this->company_id,
            'employee_id' => $this->employee_id,
            'attendance_policy_id' => $this->attendance_policy_id,
            'attendance_date' => $this->attendance_date,
            'clocked_in_at' => $this->clocked_in_at,
            'clocked_out_at' => $this->clocked_out_at,
            'regular_hours' => $this->regular_hours,
            'overtime_hours' => $this->overtime_hours,
            'status' => $this->status,
            'metadata' => $this->metadata,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
