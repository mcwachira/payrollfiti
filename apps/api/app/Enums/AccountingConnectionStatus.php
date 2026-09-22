<?php

declare(strict_types=1);

namespace App\Enums;

enum AccountingConnectionStatus: string
{
    case Active = 'active';
    case Disconnected = 'disconnected';
    case Expired = 'expired';
    case Error = 'error';
}
