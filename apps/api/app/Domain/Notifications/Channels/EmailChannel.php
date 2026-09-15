<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Channels;

use App\Domain\Notifications\Contracts\NotificationChannel;
use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\User;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;

/**
 * Email channel — a plain-text mail (title → subject, body → message) sent to
 * the recipient's primary email address. Body is the already-rendered
 * notification text; there is no raw HTML/HtmlString surface, so event data
 * cannot foist markup into outbound mail.
 */
final class EmailChannel implements NotificationChannel
{
    public function key(): string
    {
        return 'email';
    }

    public function send(Notification $notification, NotificationDelivery $delivery, User $recipient): void
    {
        if ($recipient->email === null || $recipient->email === '') {
            throw new \RuntimeException("Recipient [{$recipient->id}] has no email address; email delivery skipped.");
        }

        Mail::raw($notification->body, function (Message $message) use ($notification, $recipient): void {
            $message
                ->to($recipient->email, $recipient->name)
                ->subject($notification->title);
        });

        $delivery->markSent();
    }
}
