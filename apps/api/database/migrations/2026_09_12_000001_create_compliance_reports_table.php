<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('compliance_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->restrictOnDelete();

            $table->foreignUuid('payroll_run_id')
                ->constrained('payroll_runs')
                ->restrictOnDelete();

            $table->string('country', 2);

            $table->string('report_code');

            $table->string('report_version');

            $table->string('status')->default('generated');

            $table->timestampTz('generated_at')->useCurrent();

            $table->jsonb('rows')->default('[]');

            $table->jsonb('totals')->default('{}');

            $table->jsonb('metadata')->nullable();

            $table->timestampsTz();

            $table->unique(
                [
                    'tenant_id',
                    'company_id',
                    'payroll_run_id',
                    'report_code',
                    'report_version',
                ],
                'compliance_reports_unique_run_report',
            );

            $table->index([
                'tenant_id',
                'company_id',
                'country',
            ]);

            $table->index([
                'tenant_id',
                'payroll_run_id',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compliance_reports');
    }
};
