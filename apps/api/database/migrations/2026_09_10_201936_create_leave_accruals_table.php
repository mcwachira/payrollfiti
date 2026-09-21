<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_accruals', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->restrictOnDelete();

            $table->foreignUuid('leave_type_id')
                ->constrained('leave_types')
                ->restrictOnDelete();

            $table->foreignUuid('leave_balance_id')
                ->constrained('leave_balances')
                ->restrictOnDelete();

            $table->date('period');

            $table->decimal('accrued_days', 8, 2);

            $table->string('source')->default('monthly');

            $table->jsonb('meta')->nullable();

            $table->timestampsTz();

            $table->unique([
                'employee_id',
                'leave_type_id',
                'period',
            ]);

            $table->index([
                'tenant_id',
                'employee_id',
                'period',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_accruals');
    }
};
