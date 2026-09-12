<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class WebhookEndpointResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'tenant_id' => $this->tenant_id,
            'name' => $this->name,
            'url' => $this->url,
            'events' => $this->events,
            'status' => $this->status,
            'last_delivered_at' => $this->last_delivered_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    public static function deliveryLogsCollection($resource): JsonResource
    {
        return new class($resource) extends JsonResource
        {
            public function toArray($request): array
            {
                return [
                    'data' => $this->collection->map(fn ($log) => [
                        'id' => $log->id,
                        'event_type' => $log->event_type,
                        'event_id' => $log->event_id,
                        'status' => $log->status,
                        'attempts' => $log->attempts,
                        'response_status' => $log->response_status,
                        'response_time_ms' => $log->response_time_ms,
                        'error' => $log->error,
                        'delivered_at' => $log->delivered_at,
                        'next_attempt_at' => $log->next_attempt_at,
                        'created_at' => $log->created_at,
                    ])->all(),
                    'meta' => [
                        'total' => $this->total(),
                        'per_page' => $this->perPage(),
                        'current_page' => $this->currentPage(),
                    ],
                ];
            }
        };
    }
}
