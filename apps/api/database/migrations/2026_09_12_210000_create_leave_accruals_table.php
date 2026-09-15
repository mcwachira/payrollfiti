<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Part 15 §15.1 — the leave accrual ledger.
 *
 * The (employee_id, leave_type_id, period) unique constraint is the idempotency
 * guard behind `leave:accrue-monthly`: a scheduler double-fire cannot accrue an
 * employee twice for the same month because the second insert violates the
 * unique constraint and is ignored. The period is a 'YYYY-MM' literal so the
 * ledger stays correct even if the scheduler lags or is re-run out of order.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_accruals', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->foreignUuid('leave_type_id')->constrained('leave_types')->restrictOnDelete();
            $table->foreignUuid('leave_balance_id')->constrained('leave_balances')->cascadeOnDelete();
            $table->string('period', 7);
            $table->decimal('accrued_days', 8, 2);
            $table->string('source', 32)->default('monthly');
            $table->text('meta')->nullable();
            $table->timestampsTz();

            $table->unique(['employee_id', 'leave_type_id', 'period']);
            $table->index(['tenant_id', 'employee_id', 'period']);
        });

        // Defense-in-depth: same policy applied to every other tenant-scoped
        // table (2026_09_10_202014_enable_tenant_rls.php). The application layer
        // enforces isolation via TenantScope; Postgres RLS is the second line.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE leave_accruals ENABLE ROW LEVEL SECURITY');
            DB::statement(<<<'SQL'
                CREATE POLICY tenant_isolation_policy ON leave_accruals
                USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
            SQL);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_accruals');
    }
};
