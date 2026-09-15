<?php

declare(strict_types=1);

namespace App\Listeners\Documents;

use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 15 §15.4: document event listener.
 *
 * Handles post-upload side effects like notifications.
 */
final class HandleDocumentUploaded implements ShouldQueue
{
    public $queue = 'documents';

    public $tries = 3;

    public function handle(array $event): void
    {
        TenantContext::set($event['tenantId']);
    }
}
