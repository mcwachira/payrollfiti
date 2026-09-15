<?php

declare(strict_types=1);

namespace App\Domain\Notifications;

use App\Domain\Notifications\Contracts\NotificationChannel;
use RuntimeException;

/**
 * Registered channel key → implementation. Populated in
 * NotificationServiceProvider::register() with the four default channels;
 * tenants/plugins could append additional channels here.
 */
final class ChannelRegistry
{
    /** @var array<string, NotificationChannel> */
    private array $channels = [];

    public function register(NotificationChannel $channel): self
    {
        $this->channels[$channel->key()] = $channel;

        return $this;
    }

    public function has(string $key): bool
    {
        return isset($this->channels[$key]);
    }

    public function get(string $key): NotificationChannel
    {
        return $this->channels[$key]
            ?? throw new RuntimeException("Notification channel [{$key}] is not registered.");
    }

    /** @return string[] */
    public function keys(): array
    {
        return array_keys($this->channels);
    }
}
