<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $checks = [
            ['payroll_periods', 'payroll_period_dates_check', 'period_end >= period_start'],
            ['payroll_runs', 'payroll_run_period_dates_check', 'period_end >= period_start'],
            ['leave_balances', 'leave_balances_nonnegative_check', 'allocated_days >= 0 AND carried_forward_days >= 0 AND used_days >= 0 AND pending_days >= 0 AND available_days >= 0'],
            ['leave_requests', 'leave_requests_dates_check', 'end_date >= start_date AND days_requested > 0'],
            ['loan_products', 'loan_products_amounts_check', 'annual_interest_rate >= 0 AND (maximum_principal IS NULL OR maximum_principal >= 0)'],
            ['loans', 'loans_amounts_check', 'principal_amount > 0 AND interest_amount >= 0 AND total_amount = principal_amount + interest_amount AND outstanding_amount >= 0 AND outstanding_amount <= total_amount'],
            ['loan_repayments', 'loan_repayments_amounts_check', 'principal_amount >= 0 AND interest_amount >= 0 AND total_amount = principal_amount + interest_amount AND paid_amount >= 0 AND paid_amount <= total_amount'],
            ['attendance_records', 'attendance_hours_check', 'regular_hours >= 0 AND overtime_hours >= 0'],
            ['timesheets', 'timesheets_period_check', 'period_end >= period_start AND regular_hours >= 0 AND overtime_hours >= 0'],
            ['invoices', 'invoices_amounts_check', 'subtotal >= 0 AND tax >= 0 AND total >= 0 AND billing_period_end >= billing_period_start'],
            ['usage_records', 'usage_records_quantity_check', 'quantity >= 0'],
            ['payment_transactions', 'payment_transactions_amount_check', 'amount > 0'],
        ];

        foreach ($checks as [$table, $constraint, $expression]) {
            DB::statement(sprintf(
                'ALTER TABLE "%s" ADD CONSTRAINT "%s" CHECK (%s)',
                $table,
                $constraint,
                $expression
            ));
        }
    }

    public function down(): void
    {
        $constraints = [
            'payroll_periods' => ['payroll_period_dates_check'],
            'payroll_runs' => ['payroll_run_period_dates_check'],
            'leave_balances' => ['leave_balances_nonnegative_check'],
            'leave_requests' => ['leave_requests_dates_check'],
            'loan_products' => ['loan_products_amounts_check'],
            'loans' => ['loans_amounts_check'],
            'loan_repayments' => ['loan_repayments_amounts_check'],
            'attendance_records' => ['attendance_hours_check'],
            'timesheets' => ['timesheets_period_check'],
            'invoices' => ['invoices_amounts_check'],
            'usage_records' => ['usage_records_quantity_check'],
            'payment_transactions' => ['payment_transactions_amount_check'],
        ];

        foreach ($constraints as $table => $names) {
            foreach ($names as $constraint) {
                DB::statement(sprintf(
                    'ALTER TABLE "%s" DROP CONSTRAINT IF EXISTS "%s"',
                    $table,
                    $constraint
                ));
            }
        }
    }
};
