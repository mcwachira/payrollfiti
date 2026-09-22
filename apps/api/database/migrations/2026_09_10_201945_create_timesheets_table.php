<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timesheets', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();

            $table->foreignUuid('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->date('period_start');
            $table->date('period_end');

            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);

            $table->string('status')->default('draft');

            $table->timestampTz('approved_at')->nullable();

            $table->jsonb('summary')->nullable();

            $table->timestampsTz();

            $table->unique([
                'employee_id',
                'period_start',
                'period_end',
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheets');
    }
};
