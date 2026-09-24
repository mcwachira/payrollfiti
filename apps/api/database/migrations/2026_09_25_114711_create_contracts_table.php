<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            /*
             * Direct tenant ownership is intentional.
             *
             * Employee also belongs to a tenant, but keeping tenant_id directly
             * on contracts allows:
             * - tenant-scoped queries without joining employees
             * - PostgreSQL RLS directly on this table
             * - consistent tenant indexing
             */
            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();

            /*
             * Human/business reference for the employment agreement.
             *
             * Example:
             * CNT-EMP-0001-2026
             */
            $table->string('contract_number');

            /*
             * Examples:
             * permanent
             * fixed_term
             * probationary
             * temporary
             * internship
             */
            $table->string('contract_type');

            /*
             * draft
             * active
             * expired
             * terminated
             * cancelled
             */
            $table->string('status')->default('draft');

            /*
             * Preserve the contractual title at the time the agreement
             * was created instead of relying only on Employee.position_id.
             */
            $table->string('job_title');

            $table->date('start_date');

            /*
             * NULL means an indefinite/permanent contract.
             */
            $table->date('end_date')->nullable();

            $table->date('probation_end_date')->nullable();

            $table->unsignedSmallInteger('notice_period_days')->nullable();

            $table->decimal('working_hours_per_week', 5, 2)->nullable();

            /*
             * A contract may reference a compensation structure.
             *
             * This is nullable because not every contract necessarily uses
             * a salary structure immediately (for example, a draft contract).
             */
            $table->foreignUuid('salary_structure_id')
                ->nullable()
                ->constrained('salary_structures')
                ->nullOnDelete();

            $table->text('notes')->nullable();

            $table->timestampsTz();

            /*
             * A contract number only needs to be unique inside a tenant.
             */
            $table->unique(
                ['tenant_id', 'contract_number'],
                'contracts_tenant_contract_number_unique'
            );

            /*
             * Common employee history query:
             *
             * SELECT ...
             * FROM contracts
             * WHERE tenant_id = ?
             *   AND employee_id = ?
             * ORDER BY start_date DESC;
             */
            $table->index(
                ['tenant_id', 'employee_id', 'start_date'],
                'contracts_tenant_employee_start_date_index'
            );

            /*
             * Common active-contract query.
             */
            $table->index(
                ['tenant_id', 'employee_id', 'status'],
                'contracts_tenant_employee_status_index'
            );

            /*
             * Useful for company/HR reporting through employee joins.
             */
            $table->index(
                ['tenant_id', 'status'],
                'contracts_tenant_status_index'
            );

            /*
             * Basic domain integrity.
             *
             * end_date cannot be before start_date.
             *
             * NOTE:
             * PostgreSQL-specific CHECK constraints are intentionally kept
             * in a dedicated schema-check migration if that is the pattern
             * already used throughout PayrollFiti.
             */
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
