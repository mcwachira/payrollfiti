<?php

declare(strict_types=1);

namespace App\Domain\Loans\Services;

use App\Domain\Loans\Events\LoanApproved;
use App\Models\Loan;
use App\Models\LoanRepayment;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Carbon;

/**
 * LoanService — owns the loan approval and repayment schedule generation
 * (Part 15 §15.2).
 *
 * The Loan model handles the state machine; this service materialises
 * the immutable repayment schedule when a loan is approved.
 */
final class LoanService implements ShouldQueue
{
    public $queue = 'loans';

    public $tries = 3;

    public function approve(Loan $loan, User $actor, ?string $notes = null): void
    {
        \DB::transaction(function () use ($loan, $actor, $notes) {
            $loan->transitionTo('active', $actor, $notes);

            $this->generateRepaymentSchedule($loan);

            LoanApproved::dispatch(
                $loan->tenant_id,
                $loan->id,
                $loan->employee_id,
                $loan->loan_product_id,
                (float) $loan->principal_amount,
                (float) $loan->interest_amount,
                (float) $loan->total_amount,
                (int) $loan->term_months,
            );
        });
    }

    public function reject(Loan $loan, User $actor, ?string $notes = null): void
    {
        \DB::transaction(function () use ($loan, $actor, $notes) {
            $loan->transitionTo('rejected', $actor, $notes);
        });
    }

    public function complete(Loan $loan): void
    {
        \DB::transaction(function () use ($loan) {
            $loan->transitionTo('completed');
        });
    }

    private function generateRepaymentSchedule(Loan $loan): void
    {
        $product = $loan->loanProduct;
        $monthlyPrincipal = (float) $loan->principal_amount / (int) $loan->term_months;
        $monthlyInterest = (float) $loan->interest_amount / (int) $loan->term_months;
        $monthlyTotal = $monthlyPrincipal + $monthlyInterest;

        $startDate = Carbon::parse($loan->start_date);

        for ($i = 1; $i <= (int) $loan->term_months; $i++) {
            $dueDate = $startDate->copy()->addMonths($i - 1)->toDateString();

            LoanRepayment::create([
                'tenant_id' => $loan->tenant_id,
                'loan_id' => $loan->id,
                'installment_number' => $i,
                'due_date' => $dueDate,
                'principal_amount' => round($monthlyPrincipal, 2),
                'interest_amount' => round($monthlyInterest, 2),
                'total_amount' => round($monthlyTotal, 2),
                'status' => 'scheduled',
            ]);
        }
    }
}
