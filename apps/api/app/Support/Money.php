<?php

namespace App\Support;

final class Money
{
    public function toMinor(string $amount): string
    {
        return bcdiv(bcmul($amount, '100', 4), '1', 0);
    }
}
