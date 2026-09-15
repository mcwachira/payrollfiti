<?php

declare(strict_types=1);

namespace App\Domain\Accounting\Contracts;

enum SyncStatus: string
{
    case Synced = 'synced';
    case Failed = 'failed';
    case Skipped = 'skipped';
    case PendingExternal = 'pending_external';
}
