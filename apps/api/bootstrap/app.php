<?php

use App\Http\Middleware\PreventRequestForgeryCompat;
use App\Http\Middleware\SetCurrentTenantContext;
use App\Providers\AccountingServiceProvider;
use App\Providers\EventServiceProvider;
use App\Providers\NotificationServiceProvider;
use App\Providers\PaymentServiceProvider;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([
        PaymentServiceProvider::class,
        EventServiceProvider::class,
        NotificationServiceProvider::class,
        AccountingServiceProvider::class,
    ])
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withEvents(discover: false)
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant.context' => SetCurrentTenantContext::class,
        ]);

        $middleware->replaceInGroup('web', PreventRequestForgery::class, PreventRequestForgeryCompat::class);
        $middleware->appendToGroup('web', SetCurrentTenantContext::class);
        $middleware->appendToGroup('api', SetCurrentTenantContext::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
