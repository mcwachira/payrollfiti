<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Notification queue
    |--------------------------------------------------------------------------
    |
    | Delivery jobs run on this queue (already declared in config/horizon.php).
    |
    */
    'queue' => env('NOTIFICATIONS_QUEUE', 'notifications'),

    /*
    |--------------------------------------------------------------------------
    | Recognised channels
    |--------------------------------------------------------------------------
    |
    | Order here also drives UI rendering order. Channels not listed are not
    | registered in ChannelRegistry and deliveries for them are rejected.
    |
    */
    'channels' => ['in_app', 'email', 'sms', 'push'],

    /*
    |--------------------------------------------------------------------------
    | Per-channel defaults
    |--------------------------------------------------------------------------
    |
    | Applied when a user has no NotificationPreference row yet. Specific
    | fallbacks for known event types live in NotificationTypes; this list is
    | the generic fallback for unknown/custom event types.
    |
    */
    'channel_defaults' => [
        'in_app' => true,
        'email' => true,
        'sms' => false,
        'push' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | API list pagination
    |--------------------------------------------------------------------------
    */
    'list_limit' => (int) env('NOTIFICATIONS_LIST_LIMIT', 50),
];
