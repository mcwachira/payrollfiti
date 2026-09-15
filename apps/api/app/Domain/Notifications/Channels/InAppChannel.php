<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Channels;

use App\Domain\Notifications\Contracts\NotificationChannel;
use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\User;

/**
 * In-app channel. The notification row itself IS the bell entry — there is no
 * transport. A delivery row is still recorded (status sent) so administrators
 * get a uniform per-channel audit trail.
 */
final class InAppChannel implements NotificationChannel
{
    public function key(): string
    {
        return 'in_app';
    }

    public function send(Notification $notification, NotificationDelivery $delivery, User $recipient): void
    {
        $delivery->markSent();
    }
}
