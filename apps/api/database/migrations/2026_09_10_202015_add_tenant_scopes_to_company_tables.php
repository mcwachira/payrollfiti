<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COMPANY_TABLES = [
        'departments',
        'positions',
        'work_locations',
        'salary_components',
        'salary_structures',
        'payroll_settings',
        'pay_schedules',
        'payroll_periods',
    ];

    private const EMPLOYEE_TABLES = [
        'employee_employment_history',
        'employee_compensation_history',
        'employee_bank_accounts',
        'employee_tax_profiles',
        'employee_dependants',
        'employee_emergency_contacts',
        'onboarding_tasks',
    ];

    private const DERIVED_TABLES = [
        'salary_structure_components' => 'salary_structures',
        'payroll_entry_items' => 'payroll_entries',
        'payslips' => 'payroll_entries',
    ];

    public function up(): void
    {
        foreach (array_merge(self::COMPANY_TABLES, self::EMPLOYEE_TABLES, array_keys(self::DERIVED_TABLES)) as $table) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->uuid('tenant_id')->nullable();
            });
        }

        foreach (self::COMPANY_TABLES as $table) {
            DB::statement(sprintf(
                'UPDATE "%s" AS child SET tenant_id = companies.tenant_id FROM companies WHERE companies.id = child.company_id',
                $table
            ));
        }

        foreach (self::EMPLOYEE_TABLES as $table) {
            DB::statement(sprintf(
                'UPDATE "%s" AS child SET tenant_id = employees.tenant_id FROM employees WHERE employees.id = child.employee_id',
                $table
            ));
        }

        DB::statement(
            'UPDATE salary_structure_components AS child SET tenant_id = companies.tenant_id FROM salary_structures JOIN companies ON companies.id = salary_structures.company_id WHERE salary_structures.id = child.salary_structure_id'
        );
        DB::statement(
            'UPDATE payroll_entry_items AS child SET tenant_id = payroll_entries.tenant_id FROM payroll_entries WHERE payroll_entries.id = child.payroll_entry_id'
        );
        DB::statement(
            'UPDATE payslips AS child SET tenant_id = payroll_entries.tenant_id FROM payroll_entries WHERE payroll_entries.id = child.payroll_entry_id'
        );

        foreach (array_merge(self::COMPANY_TABLES, self::EMPLOYEE_TABLES, array_keys(self::DERIVED_TABLES)) as $table) {
            DB::statement(sprintf('ALTER TABLE "%s" ALTER COLUMN tenant_id SET NOT NULL', $table));
            Schema::table($table, function (Blueprint $blueprint) use ($table): void {
                $blueprint->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
                $blueprint->index('tenant_id', $table . '_tenant_id_index');
            });

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
        $tables = array_merge(self::COMPANY_TABLES, self::EMPLOYEE_TABLES, array_keys(self::DERIVED_TABLES));

        foreach (array_reverse($tables) as $table) {
            DB::statement(sprintf('DROP POLICY IF EXISTS "%s_tenant_isolation" ON "%s"', $table, $table));
            DB::statement(sprintf('ALTER TABLE "%s" NO FORCE ROW LEVEL SECURITY', $table));
            DB::statement(sprintf('ALTER TABLE "%s" DISABLE ROW LEVEL SECURITY', $table));
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->dropForeign(['tenant_id']);
                $blueprint->dropColumn('tenant_id');
            });
        }
    }
};
