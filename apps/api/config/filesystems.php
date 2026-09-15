<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        /*
        |--------------------------------------------------------------------------
        | Payslips (Part 13)
        |--------------------------------------------------------------------------
        |
        | Legal records that must survive container restarts and be retrievable
        | regardless of which worker rendered them. Local FD processing in
        | development (root = PAYSLIP_STORAGE_DIR); flip FILESYSTEM_PAYSLIP_DISK
        | to "s3" in production to store on S3-compatible object storage. Every
        | object key is prefixed tenants/{tenant_id}/... (Part 8 §8.5).
        |
        */

        'payslips' => env('FILESYSTEM_PAYSLIP_DISK', 'local') === 's3' ? [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => true,
            'report' => true,
        ] : [
            'driver' => 'local',
            'root' => env('PAYSLIP_STORAGE_DIR', storage_path('app/private/payslips')),
            'throw' => true,
            'report' => true,
        ],

        /*
        |--------------------------------------------------------------------------
        | Employee documents (Part 15 §15.4)
        |--------------------------------------------------------------------------
        |
        | The same pattern as payslips: PII-grade legal records with tenant-
        | prefixed object keys (tenants/{tenant_id}/documents/..., §8.5) served
        | only through short-lived signed URLs — never a public bucket, never a
        | permanent exposed URL. Flip FILESYSTEM_DOCUMENT_DISK to "s3" in
        | production; local FD processing in development keeps tests hermetic.
        |
        */

        'documents' => env('FILESYSTEM_DOCUMENT_DISK', 'local') === 's3' ? [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => true,
            'report' => true,
        ] : [
            'driver' => 'local',
            'root' => env('DOCUMENT_STORAGE_DIR', storage_path('app/private/documents')),
            'throw' => true,
            'report' => true,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
