<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Domain\Notifications\NotificationTypes;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * JSON shape consumed by the Next.js notification centre:
 *
 *   {
 *     "id", "title", "message", "read", "metadata",
 *     "createdAt", "event_type", "category"
 *   }
 *
 * `message` mirrors the in-app body; `metadata` is the raw event data.
 */
class NotificationResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'message' => $this->body,
            'read' => $this->read_at !== null,
            'metadata' => $this->data,
            'createdAt' => $this->created_at?->toIso8601String(),
            'event_type' => $this->event_type,
            'category' => NotificationTypes::category($this->event_type),
        ];
    }
}
