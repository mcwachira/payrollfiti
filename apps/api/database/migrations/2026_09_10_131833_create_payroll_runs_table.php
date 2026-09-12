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
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->foreignUuid('payroll_period_id')
                ->constrained('payroll_periods')
                ->restrictOnDelete();

            $table->date('period_start');
            $table->date('period_end');
            $table->date('pay_date');

            $table->string('status')->default('draft');

            $table->char('input_hash', 64);

            $table->foreignUuid('rule_set_id')
                ->nullable()
                ->constrained('statutory_rule_sets')
                ->nullOnDelete();

            /*
             * Keep the actual version string/snapshot as well.
             * This protects historical reproducibility if rule metadata changes.
             */
            $table->string('rule_version');

            $table->foreignUuid('initiated_by')
                ->constrained('users')
                ->restrictOnDelete();

            $table->foreignUuid('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestampTz('approved_at')->nullable();

            $table->foreignUuid('finalized_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestampTz('finalized_at')->nullable();

            $table->foreignUuid('corrects_run_id')
                ->nullable();

            $table->jsonb('input_snapshot')->nullable();

            $table->timestampsTz();

            $table->unique([
                'tenant_id',
                'company_id',
                'input_hash'
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'status'
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'period_start',
                'period_end'
            ]);

        });

        Schema::table('payroll_runs', function (Blueprint $table): void {
            $table->foreign('corrects_run_id')
                ->references('id')
                ->on('payroll_runs')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_runs');
    }
};
