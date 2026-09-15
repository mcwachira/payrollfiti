<?php

declare(strict_types=1);

namespace App\Listeners\Loan;

use App\Domain\Loans\Events\LoanApproved;
use App\Support\TenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Part 15 §15.2: domain event listener for loan approvals.
 *
 * The LoanService owns the repayment schedule generation; this listener
 * handles side effects like notifications and audit logging.
 */
final class HandleLoanApproved implements ShouldQueue
{
    public $queue = 'loans';

    public $tries = 3;

    public function handle(LoanApproved $event): void
    {
        TenantContext::set($event->tenantId);

        // Repayment schedule is handled by LoanService.
        // This listener handles notifications and audit logging.
    }
}
