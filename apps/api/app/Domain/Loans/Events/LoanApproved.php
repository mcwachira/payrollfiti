<?php

declare(strict_types=1);

namespace App\Domain\Loans\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Emitted when a loan transitions to active (Part 15 §15.2).
 *
 * The listener materialises the immutable repayment schedule.
 */
final class LoanApproved
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $tenantId,
        public string $loanId,
        public string $employeeId,
        public string $loanProductId,
        public float $principalAmount,
        public float $interestAmount,
        public float $totalAmount,
        public int $termMonths,
    ) {}
}
