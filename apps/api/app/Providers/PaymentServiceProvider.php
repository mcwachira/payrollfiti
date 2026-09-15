<?php

namespace App\Providers;

use App\Domain\Payments\PaymentProviderManager;
use App\Infrastructure\Payments\CurlClient;
use App\Infrastructure\Payments\MpesaProvider;
use App\Infrastructure\Payments\PaystackProvider;
use App\Support\Money;
use Illuminate\Support\ServiceProvider;

class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Money::class, fn () => new Money);
        $this->app->singleton(CurlClient::class, fn () => new CurlClient);

        $this->app->singleton(PaymentProviderManager::class, function ($app) {
            $manager = new PaymentProviderManager;

            $manager->register(new PaystackProvider($app[CurlClient::class], $app[Money::class]));
            $manager->register(new MpesaProvider($app[CurlClient::class], $app[Money::class]));

            return $manager;
        });

        $this->app->alias(PaymentProviderManager::class, 'payments.manager');
    }
}
