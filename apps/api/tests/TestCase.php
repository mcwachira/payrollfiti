<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        if (getenv('APP_ENV') !== 'testing') {
            putenv('APP_ENV=testing');
            $_ENV['APP_ENV'] = 'testing';
            $_SERVER['APP_ENV'] = 'testing';
        }

        if (getenv('QUEUE_CONNECTION') !== 'sync') {
            putenv('QUEUE_CONNECTION=sync');
            $_ENV['QUEUE_CONNECTION'] = 'sync';
            $_SERVER['QUEUE_CONNECTION'] = 'sync';
        }

        $app = parent::createApplication();

        file_put_contents('/tmp/testcase_debug.log', "APP_ENV=" . getenv('APP_ENV') . "\n", FILE_APPEND);
        file_put_contents('/tmp/testcase_debug.log', "envFile=" . $app->environmentFile() . "\n", FILE_APPEND);
        file_put_contents('/tmp/testcase_debug.log', "MAIL_MAILER env=" . getenv('MAIL_MAILER') . "\n", FILE_APPEND);
        file_put_contents('/tmp/testcase_debug.log', "MAIL_MAILER _ENV=" . ($_ENV['MAIL_MAILER'] ?? 'not-set') . "\n", FILE_APPEND);
        file_put_contents('/tmp/testcase_debug.log', "MAIL_MAILER app=" . $app->environment('MAIL_MAILER', 'not-set') . "\n", FILE_APPEND);
        file_put_contents('/tmp/testcase_debug.log', "MAIL_MAILER env()=" . env('MAIL_MAILER', 'not-set') . "\n", FILE_APPEND);

        return $app;
    }
}
