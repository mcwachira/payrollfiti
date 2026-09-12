<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Notifications\ChannelRegistry;
use App\Domain\Notifications\Channels\EmailChannel;
use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Channels\PushChannel;
use App\Domain\Notifications\Channels\SmsChannel;
use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\Providers\LogPushProvider;
use App\Domain\Notifications\Providers\LogSmsProvider;
use App\Domain\Notifications\Providers\PushProvider;
use App\Domain\Notifications\Providers\SmsProvider;
use App\Domain\Notifications\TemplateRenderer;
use Illuminate\Support\ServiceProvider;

/**
 * Part 14 wiring: channel registry, renderer, dispatcher and the provider
 * boundaries. SMS/Push default to the logging implementations so the whole
 * pipeline works without credentials; swapping a production provider is a
 * one-line rebind (SmsProvider / PushProvider) in this provider.
 */
class NotificationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ChannelRegistry::class, function ($app) {
            return (new ChannelRegistry)
                ->register(new InAppChannel)
                ->register(new EmailChannel)
                ->register(new SmsChannel($app->make(SmsProvider::class)))
                ->register(new PushChannel($app->make(PushProvider::class)));
        });

        $this->app->singleton(TemplateRenderer::class);
        $this->app->singleton(NotificationDispatcher::class);

        $this->app->bind(SmsProvider::class, LogSmsProvider::class);
        $this->app->bind(PushProvider::class, LogPushProvider::class);
    }
}
