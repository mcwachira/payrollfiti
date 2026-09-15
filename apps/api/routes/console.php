<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('payments:reconcile-pending')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->when(fn () => app()->environment() !== 'testing');

Schedule::command('billing:process-subscription-renewals')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->when(fn () => app()->environment() !== 'testing');

// Part 13 §13.7: transactional outbox relay. Runs on the `scheduler` service
// (schedule:work). Safe on multiple instances thanks to FOR UPDATE SKIP LOCKED;
// a minutely tick bounded by a 500-row claim is more than enough headroom.
Schedule::command('queue:dispatch-outbox')
    ->everyFiveSeconds()
    ->when(fn () => app()->environment() !== 'testing');

// Part 15 §15.1: monthly leave accrual.
Schedule::command('leave:accrue-monthly')
    ->monthlyOn(1, '00:00')
    ->withoutOverlapping()
    ->when(fn () => app()->environment() !== 'testing');

// Part 15 §15.2: process loan repayments.
Schedule::command('loans:process-repayments')
    ->hourly()
    ->withoutOverlapping()
    ->when(fn () => app()->environment() !== 'testing');
