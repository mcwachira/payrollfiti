<?php

declare(strict_types=1);

namespace App\Enums;

enum WebhookDeliveryStatus: string
{
    case Pending = 'pending';
    case Sending = 'sending';
    case Delivered = 'delivered';
    case Failed = 'failed';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Delivered,
            self::Failed => true,

            self::Pending,
            self::Sending => false,
        };
    }
}
