<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Contracts;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\User;

/**
 * Transport boundary for one notification channel. Implementations are
 * responsible for a single best-effort hand-off of a rendered notification to
 * its backend (in-app row already exists, Mail, SMS provider, push provider).
 *
 * Contract:
 *  - key()          stable channel key (in_app / email / sms / push)
 *  - send()         performs the hand-off; MUST call $delivery->markSent()
 *                   (or markFailed()) on success/failure semantics; the caller
 *                   (SendNotificationDelivery) owns attempt bookkeeping.
 *
 * A channel that cannot reach the recipient should throw — the job layer then
 * records last_error and retries with backoff before dead-lettering.
 */
interface NotificationChannel
{
    public function key(): string;

    public function send(Notification $notification, NotificationDelivery $delivery, User $recipient): void;
}
