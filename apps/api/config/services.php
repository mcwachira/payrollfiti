<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'paystack' => [
        'secret_key' => env('PAYSTACK_SECRET_KEY'),
        'base_url' => env('PAYSTACK_BASE_URL', 'https://api.paystack.co'),
    ],

    'mpesa' => [
        'consumer_key' => env('MPESA_CONSUMER_KEY'),
        'consumer_secret' => env('MPESA_CONSUMER_SECRET'),
        'base_url' => env('MPESA_BASE_URL', env('MPESA_ENV', 'sandbox') === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'),
        'shortcode' => env('MPESA_SHORTCODE'),
        'passkey' => env('MPESA_PASSKEY'),
        'callback_url' => env('MPESA_CALLBACK_URL'),
        'callback_token' => env('MPESA_CALLBACK_TOKEN'),
    ],

    'xero' => [
        'client_id' => env('XERO_CLIENT_ID'),
        'client_secret' => env('XERO_CLIENT_SECRET'),
        'redirect' => env('APP_URL').'/api/accounting/integrations/callback/xero',
        'authorize_url' => 'https://login.xero.com/identity/connect/authorize',
        'token_url' => 'https://identity.xero.com/connect/token',
        'user_url' => 'https://api.xero.com/connections',
        'user_id_field' => 'tenantId',
    ],

    'quickbooks' => [
        'client_id' => env('QUICKBOOKS_CLIENT_ID'),
        'client_secret' => env('QUICKBOOKS_CLIENT_SECRET'),
        'redirect' => env('APP_URL').'/api/accounting/integrations/callback/quickbooks',
        'environment' => env('QUICKBOOKS_ENVIRONMENT', 'sandbox'),
        'authorize_url' => 'https://appcenter.intuit.com/connect/oauth2',
        'token_url' => 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        'user_url' => 'https://quickbooks.api.intuit.com/v3/userinfo',
        'user_id_field' => 'sub',
    ],

    'zoho_books' => [
        'client_id' => env('ZOHO_BOOKS_CLIENT_ID'),
        'client_secret' => env('ZOHO_BOOKS_CLIENT_SECRET'),
        'redirect' => env('APP_URL').'/api/accounting/integrations/callback/zoho_books',
        'region' => env('ZOHO_BOOKS_REGION', 'com'),
        'authorize_url' => 'https://accounts.zoho.com/oauth/v2/auth',
        'token_url' => 'https://accounts.zoho.com/oauth/v2/token',
        'user_url' => 'https://books.zoho.com/api/v3/users/me',
        'user_id_field' => 'id',
    ],

    /*
    |--------------------------------------------------------------------------
    | Web Push (VAPID)
    |--------------------------------------------------------------------------
    |
    | Used by the PushProvider when a real web-push transport is configured.
    | The public key is served via GET /push-subscriptions/vapid-public-key so
    | the browser can validate pushes; it is safe to expose. Subject is a
    | mailto: contact address required by the push service.
    |
    */
    'vapid' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', 'mailto:security@payrollfiti.com'),
    ],

];
