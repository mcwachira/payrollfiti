<?php

namespace Tests\Feature;

use Tests\TestCase;
use Spatie\Permission\PermissionRegistrar;

class CacheDebugTest extends TestCase
{
    public function test_cache_debug(): void
    {
        $registrar = app(PermissionRegistrar::class);
        $reflection = new \ReflectionClass($registrar);
        $cacheProp = $reflection->getProperty('cache');
        $cacheProp->setAccessible(true);
        $cache = $cacheProp->getValue($registrar);
        $store = $cache->getStore();
        
        $keyProp = $reflection->getProperty('cacheKey');
        $keyProp->setAccessible(true);
        $cacheKey = $keyProp->getValue($registrar);
        
        file_put_contents('/tmp/cache_debug.txt', "Cache store: " . get_class($store) . "\nCache key: " . $cacheKey . "\nValue: " . print_r(\Illuminate\Support\Facades\Cache::get($cacheKey), true) . "\n");
    }
}
