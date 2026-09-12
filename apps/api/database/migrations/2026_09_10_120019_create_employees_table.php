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
        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->foreignUuid('department_id')
                ->nullable()
                ->constrained('departments')
                ->nullOnDelete();

            $table->foreignUuid('position_id')
                ->nullable()
                ->constrained('positions')
                ->nullOnDelete();

            $table->foreignUuid('work_location_id')
                ->nullable()
                ->constrained('work_locations')
                ->nullOnDelete();

            $table->foreignUuid('salary_structure_id')
                ->nullable()
                ->constrained('salary_structures')
                ->nullOnDelete();

            $table->string('employee_number');

            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');

            $table->string('email')->nullable();
            $table->string('phone')->nullable();

            $table->string('country', 2);

            $table->date('hire_date');
            $table->date('termination_date')->nullable();

            $table->string('status')->default('active');

            $table->date('date_of_birth')->nullable();

            $table->string('gender')->nullable();

            $table->string('national_id_encrypted')->nullable();

            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique([
                'tenant_id',
                'company_id',
                'employee_number'
            ]);

            $table->index([
                'tenant_id',
                'company_id',
                'status'
            ]);

            $table->index([
                'tenant_id',
                'email'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
