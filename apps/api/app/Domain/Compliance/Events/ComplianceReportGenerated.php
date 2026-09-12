<?php

declare(strict_types=1);

namespace App\Domain\Compliance\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted by ComplianceReportService whenever a NEW compliance report row is
 * generated (the idempotent upsert only notifies on actual new records).
 * Consumed by the Part 14 notification fan-out via EventServiceProvider.
 */
class ComplianceReportGenerated
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $tenantId,
        public string $reportId,
        public ?string $initiatedBy = null,
    ) {}
}
