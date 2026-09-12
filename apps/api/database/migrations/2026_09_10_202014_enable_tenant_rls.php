<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * RLS is a defense-in-depth layer. Application middleware must set
     * app.current_tenant_id on every tenant-scoped connection.
     */
    private const TABLES = [
        'companies',
        'users',
        'roles',
        'employees',
        'payroll_runs',
        'payroll_entries',
        'leave_types',
        'leave_balances',
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
        'payment_provider_events',
        'notification_templates',
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
        'outbox_events',
        'audit_logs',
        'report_jobs',
        'export_jobs',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            DB::statement(sprintf('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY', $table));
            DB::statement(sprintf('ALTER TABLE "%s" FORCE ROW LEVEL SECURITY', $table));
            DB::statement(sprintf(
                'CREATE POLICY "%s_tenant_isolation" ON "%s" USING (tenant_id = NULLIF(current_setting(\'app.current_tenant_id\', true), \'\')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(\'app.current_tenant_id\', true), \'\')::uuid)',
                $table,
                $table
            ));
        }
    }

    public function down(): void
    {
        foreach (array_reverse(self::TABLES) as $table) {
            DB::statement(sprintf('DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"', $table, $table));
            DB::statement(sprintf('ALTER TABLE "%s" NO FORCE ROW LEVEL SECURITY', $table));
            DB::statement(sprintf('ALTER TABLE "%s" DISABLE ROW LEVEL SECURITY', $table));
        }
    }
};
