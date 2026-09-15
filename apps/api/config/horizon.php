<?php

declare(strict_types=1);

use Illuminate\Support\Str;

/*
 * Part 13 — Queues, Redis & Messaging.
 *
 * Queue topology (one Redis-backed queue per concern, per the Build Guide §13.2):
 *
 *   high          — time-sensitive, small payload (2FA codes, password resets)
 *   default       — general-purpose, low volume
 *   payroll       — payroll-run post-processing (payslip generation fan-out)
 *   notifications — in-app notification writes
 *   email         — outbound email delivery
 *   sms           — outbound SMS delivery
 *   webhooks      — outbound delivery to tenant-registered endpoints AND inbound
 *                   payment-provider event processing (ProcessPaymentWebhook)
 *   reports       — compliance report generation
 *   exports       — bulk data exports (CSV/XLSX)
 *   integrations  — accounting-platform sync (OAuth-bound, rate-limited)
 *
 * Worker counts are weighted toward payroll and email during typical end-of-month
 * traffic, and `balance => 'auto'` lets idle capacity on sms/exports be redirected
 * to payroll under burst load.
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Horizon Path
    |--------------------------------------------------------------------------
    |
    | This is the URI path where Horizon will be accessible from. You can
    | configure this to be a unique path to prevent unwanted access to the
    | monitoring dashboard.
    |
    */

    'path' => env('HORIZON_PATH', 'horizon'),

    /*
    |--------------------------------------------------------------------------
    | Horizon Redis Connection
    |--------------------------------------------------------------------------
    |
    | This is where Horizon connects Redis for monitoring and job metadata.
    | The default connection is used; the same Redis instance that backs the
    | queues, cache, sessions, locks and rate limits.
    |
    */

    'use' => 'default',

    /*
    |--------------------------------------------------------------------------
    | Horizon Redis Prefix
    |--------------------------------------------------------------------------
    |
    | A namespaces prefix applied to every Redis key Horizon manages, keeping
    | the queue keysets distinct from application cache / lock / session keys.
    |
    */

    'prefix' => env('HORIZON_PREFIX', Str::slug((string) env('APP_NAME', 'payrollfiti'), '_').'_queue_'),

    /*
    |--------------------------------------------------------------------------
    | Horizon Route Middleware
    |--------------------------------------------------------------------------
    |
    | Middleware applied to the Horizon dashboard. Access is gated by the
    | `viewHorizon` Gate defined in AppServiceProvider (platform admins and
    | tenant admins).
    |
    */

    'middleware' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Queue Wait Time Thresholds
    |--------------------------------------------------------------------------
    |
    | These numeric values describe how many seconds a job may wait before it
    | is considered to be able to be ran in the negative. The thresholds are
    | used by the dashboard to flag jobs that have sat in the queue too long.
    |
    */

    'waits' => [
        'redis:default' => 60,
        'redis:high' => 10,
        'redis:payroll' => 120,
        'redis:notifications' => 60,
        'redis:email' => 90,
        'redis:sms' => 60,
        'redis:webhooks' => 30,
        'redis:reports' => 300,
        'redis:exports' => 300,
        'redis:integrations' => 120,
    ],

    /*
    |--------------------------------------------------------------------------
    | Job Trimming Times
    |--------------------------------------------------------------------------
    |
    | The number of days Horizon may keep recent job metrics and recent events.
    |
    */

    'trim' => [
        'recent' => 7,
        'pending' => 30,
        'completed' => 30,
        'recent_failed' => 30,
        'failed' => 30,
        'monitored' => 30,
    ],

    /*
    |--------------------------------------------------------------------------
    | Silenced Jobs
    |--------------------------------------------------------------------------
    */

    'silenced' => [],

    /*
    |--------------------------------------------------------------------------
    | Metrics
    |--------------------------------------------------------------------------
    */

    'metrics' => [
        'trim_snapshots' => [
            'job' => 24,
            'queue' => 24,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Fast Termination
    |--------------------------------------------------------------------------
    |
    | Enables Horizon's soft termination of workers between cycles, useful when
    | deploying new code: running jobs finish, queued jobs are republished.
    |
    */

    'fast_termination' => false,

    /*
    |--------------------------------------------------------------------------
    | Term Wait Time
    |--------------------------------------------------------------------------
    */

    'termination_wait' => env('HORIZON_TERMINATION_WAIT', 30),

    /*
    |--------------------------------------------------------------------------
    | Default Queue
    |--------------------------------------------------------------------------
    |
    | The default queue connection + queue name Horizon starts workers against
    | when none are otherwise configured.
    |
    */

    'default_queue' => env('HORIZON_DEFAULT_QUEUE', 'default'),

    /*
    |--------------------------------------------------------------------------
    | Environments
    |--------------------------------------------------------------------------
    |
    | Per-environment supervisor configuration. Supervisors define how many
    | worker processes run for each queue, retry policy and timeouts.
    |
    */

    'environments' => [
        'production' => [
            'supervisor-default' => [
                'connection' => 'redis',
                'queue' => ['default', 'high', 'notifications', 'reports', 'exports'],
                'balance' => 'auto',
                'autoScalingStrategy' => 'time',
                'minProcesses' => 2,
                'maxProcesses' => 10,
                'balanceMaxShift' => 1,
                'balanceCooldown' => 3,
                'tries' => 3,
                'timeout' => 120,
                'nice' => 0,
            ],
            'supervisor-payroll' => [
                'connection' => 'redis',
                'queue' => ['payroll'],
                'balance' => 'auto',
                'minProcesses' => 2,
                'maxProcesses' => 20,
                'tries' => 3,
                'timeout' => 120,
            ],
            'supervisor-email' => [
                'connection' => 'redis',
                'queue' => ['email', 'sms'],
                'balance' => 'auto',
                'minProcesses' => 2,
                'maxProcesses' => 10,
                'tries' => 5,
                'backoff' => [10, 60, 300],
                'timeout' => 120,
            ],
            'supervisor-webhooks' => [
                'connection' => 'redis',
                'queue' => ['webhooks'],
                'balance' => 'auto',
                'minProcesses' => 1,
                'maxProcesses' => 8,
                'tries' => 6,
                // up to 6h exponential backoff
                'backoff' => [5, 30, 120, 600, 3600, 21600],
                'timeout' => 60,
            ],
            'supervisor-hr' => [
                'connection' => 'redis',
                'queue' => ['leave', 'loans', 'attendance', 'documents', 'onboarding'],
                'balance' => 'auto',
                'minProcesses' => 1,
                'maxProcesses' => 4,
                'tries' => 3,
                'timeout' => 120,
            ],
            'supervisor-integrations' => [
                'connection' => 'redis',
                'queue' => ['integrations'],
                'balance' => 'auto',
                'minProcesses' => 1,
                'maxProcesses' => 4,
                'tries' => 5,
                'backoff' => [30, 120, 600, 3600],
                'timeout' => 240,
            ],
        ],

        'local' => [
            'supervisor-1' => [
                'connection' => 'redis',
                'queue' => ['default', 'high', 'payroll', 'notifications', 'email', 'sms', 'webhooks', 'reports', 'exports', 'integrations'],
                'balance' => 'auto',
                'minProcesses' => 1,
                'maxProcesses' => 8,
                'tries' => 6,
                'timeout' => 120,
            ],
        ],
    ],
];
