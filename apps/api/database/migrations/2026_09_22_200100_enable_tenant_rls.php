<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TABLES = [
        'companies',
        'users',
        'roles',
        'employees',

        'departments',
        'positions',
        'work_locations',

        'salary_components',
        'salary_structures',
        'salary_structure_components',

        'employee_employment_history',
        'employee_compensation_history',
        'employee_bank_accounts',
        'employee_tax_profiles',
        'employee_dependants',
        'employee_emergency_contacts',
        'onboarding_tasks',

        'payroll_settings',
        'pay_schedules',
        'payroll_periods',
        'payroll_runs',
        'payroll_entries',
        'payroll_entry_items',

        'leave_types',
        'leave_balances',
        'leave_accruals',
        'leave_requests',
        'leave_approvals',
        'public_holidays',

        'loan_products',
        'loans',
        'loan_repayments',

        'attendance_policies',
        'attendance_records',
        'timesheets',

        'document_types',
        'employee_documents',
        'document_versions',

        'subscriptions',
        'invoices',
        'usage_records',
        'payment_transactions',

        'notification_preferences',
        'notifications',
        'notification_deliveries',
        'push_subscriptions',

        'webhook_endpoints',
        'webhook_delivery_logs',

        'api_keys',
        'api_key_permissions',
        'api_key_usage',

        'accounting_connections',
        'accounting_mappings',
        'accounting_sync_jobs',
        'accounting_sync_records',

        'invitations',
        'user_sessions',
        'two_factor_authentications',

        'idempotency_keys',
        'audit_logs',
        'report_jobs',
        'export_jobs',

        'compliance_reports',
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach (self::TABLES as $table) {
            DB::statement(sprintf(
                'ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY',
                $table,
            ));

            DB::statement(sprintf(
                'ALTER TABLE "%s" FORCE ROW LEVEL SECURITY',
                $table,
            ));

            DB::statement(sprintf(
                'DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"',
                $table,
                $table,
            ));

            DB::statement(sprintf(
                <<<'SQL'
                CREATE POLICY "%s_tenant_isolation"
                ON "%s"
                USING (
                    tenant_id =
                    NULLIF(
                        current_setting('app.current_tenant_id', true),
                        ''
                    )::uuid
                )
                WITH CHECK (
                    tenant_id =
                    NULLIF(
                        current_setting('app.current_tenant_id', true),
                        ''
                    )::uuid
                )
                SQL,
                $table,
                $table,
            ));
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach (array_reverse(self::TABLES) as $table) {
            DB::statement(sprintf(
                'DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"',
                $table,
                $table,
            ));

            DB::statement(sprintf(
                'ALTER TABLE "%s" NO FORCE ROW LEVEL SECURITY',
                $table,
            ));

            DB::statement(sprintf(
                'ALTER TABLE "%s" DISABLE ROW LEVEL SECURITY',
                $table,
            ));
        }
    }
};
