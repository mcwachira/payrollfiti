<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Accounting\AccountingProviderManager;
use App\Infrastructure\Accounting\GenericOAuth2Provider;
use App\Infrastructure\Accounting\QuickBooksProvider;
use App\Infrastructure\Accounting\XeroProvider;
use App\Infrastructure\Accounting\ZohoBooksProvider;
use Illuminate\Support\Arr;
use Illuminate\Support\ServiceProvider;
use Laravel\Socialite\Facades\Socialite;

final class AccountingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AccountingProviderManager::class, function ($app) {
            $manager = new AccountingProviderManager;

            if (config('services.xero.client_id')) {
                $manager->register(new XeroProvider);
            }

            if (config('services.quickbooks.client_id')) {
                $manager->register(new QuickBooksProvider);
            }

            if (config('services.zoho_books.client_id')) {
                $manager->register(new ZohoBooksProvider);
            }

            return $manager;
        });

        $this->app->alias(AccountingProviderManager::class, 'accounting.manager');
    }

    public function boot(): void
    {
        Socialite::extend('xero', function ($app) {
            $config = config('services.xero', []);

            return new GenericOAuth2Provider(
                $app->make('request'),
                $config['client_id'] ?? '',
                $config['client_secret'] ?? '',
                $config['redirect'] ?? '',
                Arr::get($config, 'guzzle', []),
                $config,
            );
        });

        Socialite::extend('quickbooks', function ($app) {
            $config = config('services.quickbooks', []);

            return new GenericOAuth2Provider(
                $app->make('request'),
                $config['client_id'] ?? '',
                $config['client_secret'] ?? '',
                $config['redirect'] ?? '',
                Arr::get($config, 'guzzle', []),
                $config,
            );
        });

        Socialite::extend('zoho-books', function ($app) {
            $config = config('services.zoho_books', []);

            return new GenericOAuth2Provider(
                $app->make('request'),
                $config['client_id'] ?? '',
                $config['client_secret'] ?? '',
                $config['redirect'] ?? '',
                Arr::get($config, 'guzzle', []),
                $config,
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function configFor(string $provider): array
    {
        return config('services.'.$provider, []);
    }
}
