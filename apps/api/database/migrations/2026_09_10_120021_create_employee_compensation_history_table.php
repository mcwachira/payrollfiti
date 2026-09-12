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
        Schema::create('employee_compensation_history', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('employee_id')
                ->constrained('employees')
                ->cascadeOnDelete();

            $table->foreignUuid('salary_structure_id')
                ->nullable()
                ->constrained('salary_structures')
                ->nullOnDelete();

            $table->decimal('base_salary', 18, 2);

            $table->string('currency', 3);

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->jsonb('snapshot')->nullable();

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
        Schema::dropIfExists('employee_compensation_history');
    }
};
