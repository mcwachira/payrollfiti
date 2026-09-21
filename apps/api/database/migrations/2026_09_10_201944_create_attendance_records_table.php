<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table): void {
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

            $table->foreignUuid('attendance_policy_id')
                ->nullable()
                ->constrained('attendance_policies')
                ->nullOnDelete();

            $table->date('attendance_date');

            $table->timestampTz('clocked_in_at')->nullable();
            $table->timestampTz('clocked_out_at')->nullable();

            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);

            $table->string('status')->default('present');

            $table->jsonb('metadata')->nullable();

            $table->timestampsTz();

            $table->unique([
                'employee_id',
                'attendance_date',
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'attendance_date',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
