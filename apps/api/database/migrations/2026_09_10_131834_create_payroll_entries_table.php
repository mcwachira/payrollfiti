<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payroll_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('payroll_run_id')
                ->constrained('payroll_runs')
                ->cascadeOnDelete();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();

            $table->decimal('gross_pay', 18, 2);
            $table->decimal('taxable_pay', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2);
            $table->decimal('employer_contributions', 18, 2)->default(0);
            $table->decimal('net_pay', 18, 2);

            $table->jsonb('breakdown');

            $table->timestampTz('created_at');

            $table->unique([
                'payroll_run_id',
                'employee_id'
            ]);

            $table->index([
                'tenant_id',
                'employee_id'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_entries');
    }
};
