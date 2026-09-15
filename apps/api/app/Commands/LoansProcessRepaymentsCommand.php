<?php

declare(strict_types=1);

namespace App\Commands;

use App\Models\Loan;
use App\Models\LoanRepayment;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Part 15 §15.2: loan repayment processing command.
 *
 * Iterates over all tenants, finds scheduled installments whose
 * due date has passed, and marks them as paid if the payroll run
 * has been finalized for that period.
 */
class LoansProcessRepaymentsCommand extends Command
{
    protected $signature = 'loans:process-repayments';

    protected $description = 'Process loan repayments for due installments';

    public function handle(): int
    {
        $tenants = DB::table('tenants')->select('id')->get();

        foreach ($tenants as $tenant) {
            TenantContext::set($tenant->id);

            try {
                $this->processForTenant($tenant->id);
            } finally {
                TenantContext::clear();
            }
        }

        $this->info('Loan repayment processing completed.');

        return 0;
    }

    private function processForTenant(string $tenantId): void
    {
        $scheduled = LoanRepayment::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('status', 'scheduled')
            ->where('due_date', '<=', now()->toDateString())
            ->get();

        foreach ($scheduled as $repayment) {
            if ($repayment->payrollEntry !== null && $repayment->payrollEntry->payrollRun?->status === 'finalized') {
                $repayment->update([
                    'status' => 'paid',
                    'paid_amount' => $repayment->total_amount,
                    'paid_at' => now(),
                ]);

                $loan = $repayment->loan;
                $loan->decrement('outstanding_amount', (float) $repayment->total_amount);

                if ($loan->outstanding_amount <= 0) {
                    $loan->update(['status' => 'completed', 'outstanding_amount' => 0]);
                }
            }
        }
    }
}
