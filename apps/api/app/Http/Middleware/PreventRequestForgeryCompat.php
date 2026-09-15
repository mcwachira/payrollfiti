<?php

namespace App\Http\Middleware;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

class PreventRequestForgeryCompat extends PreventRequestForgery
{
    /**
     * Laravel 13 expects encrypted XSRF values in the browser cookie header, but
     * some existing SPAs/tests send a raw token value. Accept either form while
     * still requiring the request token to match the active session token.
     */
    protected function getTokenFromRequest($request)
    {
        $token = $request->input('_token') ?: $request->header('X-CSRF-TOKEN');

        if (is_string($token) && trim($token) !== '') {
            return $token;
        }

        $header = $request->header('X-XSRF-TOKEN');

        if (! is_string($header) || trim($header) === '') {
            return null;
        }

        try {
            return CookieValuePrefix::remove($this->encrypter->decrypt($header, static::serialized()));
        } catch (DecryptException) {
            return $header;
        }
    }
}
