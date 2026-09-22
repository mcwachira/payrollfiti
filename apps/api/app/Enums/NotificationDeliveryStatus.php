<?php

declare(strict_types=1);

namespace App\Enums;

enum NotificationDeliveryStatus: string
{
    case Pending = 'pending';
    case Sending = 'sending';
    case Sent = 'sent';
    case Failed = 'failed';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Sent,
            self::Failed => true,

            self::Pending,
            self::Sending => false,
        };
    }
}
