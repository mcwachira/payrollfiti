<?php

declare(strict_types=1);

namespace App\Domain\Payroll\Events;

/**
 * Emitted by the transactional outbox relay when a payroll run reaches its
 * terminal finalized state (Part 13 §13.5 / §13.7).
 *
 * Event object is a pure value; the heavy aftermath (payslips, notifications,
 * webhooks, accounting) runs in the four queued listeners registered in
 * EventServiceProvider.
 */
final class PayrollRunCompleted
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $payrollRunId,
        public readonly array $payload = [],
    ) {}
}
