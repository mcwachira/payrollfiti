<?php

namespace Tests\Feature;

use Tests\TestCase;

class EnvTest extends TestCase
{
    public function test_env(): void
    {
        file_put_contents('/tmp/test_output.txt', "CACHE_STORE env: " . getenv('CACHE_STORE') . "\nConfig cache.default: " . config('cache.default') . "\n");
    }
}
