<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountingSyncJobResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'accounting_connection_id' => $this->resource->accounting_connection_id,
            'entity_type' => $this->resource->entity_type,
            'entity_id' => $this->resource->entity_id,
            'status' => $this->resource->status,
            'filters' => $this->resource->filters,
            'attempts' => $this->resource->attempts,
            'error' => $this->resource->error,
            'retry_at' => $this->resource->retry_at?->toIso8601String(),
            'reserved_at' => $this->resource->reserved_at?->toIso8601String(),
            'available_at' => $this->resource->available_at?->toIso8601String(),
            'queued_at' => $this->resource->queued_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'updated_at' => $this->resource->updated_at?->toIso8601String(),
        ];
    }
}
