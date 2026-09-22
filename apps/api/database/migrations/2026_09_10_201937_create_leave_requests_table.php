<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_requests', function (Blueprint $table): void {
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

            $table->foreignUuid('leave_type_id')
                ->constrained('leave_types')
                ->restrictOnDelete();

            $table->foreignUuid('submitted_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->date('start_date');
            $table->date('end_date');

            $table->decimal('days_requested', 8, 2);

            $table->text('reason')->nullable();

            $table->string('status')->default('pending');

            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('approved_at')->nullable();

            $table->timestampsTz();

            $table->index([
                'tenant_id',
                'company_id',
                'status',
            ]);

            $table->index([
                'employee_id',
                'start_date',
                'end_date',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_requests');
    }
};
