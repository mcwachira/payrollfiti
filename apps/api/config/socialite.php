<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Socialite Providers
    |--------------------------------------------------------------------------
    |
    | Custom OAuth2 providers for accounting integrations. Each provider
    | maps to a Socialite driver name and carries the credentials needed
    | for the authorization-code flow.
    |
    */

    'providers' => [
        'xero' => [
            'client_id' => env('XERO_CLIENT_ID'),
            'client_secret' => env('XERO_CLIENT_SECRET'),
            'redirect' => env('APP_URL').'/api/accounting/integrations/callback/xero',
        ],

        'quickbooks' => [
            'client_id' => env('QUICKBOOKS_CLIENT_ID'),
            'client_secret' => env('QUICKBOOKS_CLIENT_SECRET'),
            'redirect' => env('APP_URL').'/api/accounting/integrations/callback/quickbooks',
        ],

        'zoho-books' => [
            'client_id' => env('ZOHO_BOOKS_CLIENT_ID'),
            'client_secret' => env('ZOHO_BOOKS_CLIENT_SECRET'),
            'redirect' => env('APP_URL').'/api/accounting/integrations/callback/zoho_books',
        ],
    ],

];
