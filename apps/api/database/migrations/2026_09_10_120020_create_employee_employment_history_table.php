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
        Schema::create('employee_employment_history', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->cascadeOnDelete();

            $table->foreignUuid('department_id')
                ->nullable()
                ->constrained('departments')
                ->nullOnDelete();

            $table->foreignUuid('position_id')
                ->nullable()
                ->constrained('positions')
                ->nullOnDelete();

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->string('employment_type')->nullable();

            $table->timestampsTz();

            $table->index([
                'employee_id',
                'effective_from'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_employment_history');
    }
};
