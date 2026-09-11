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
        Schema::create('salary_structure_components', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('salary_structure_id')
                ->constrained('salary_structures')
                ->cascadeOnDelete();

            $table->foreignUuid('salary_component_id')
                ->constrained('salary_components')
                ->restrictOnDelete();

            $table->decimal('amount', 18, 2)->nullable();
            $table->decimal('percentage', 8, 4)->nullable();

            $table->jsonb('configuration')->nullable();

            $table->unsignedInteger('sort_order')->default(0);

            $table->timestampsTz();

            $table->unique([
                'salary_structure_id',
                'salary_component_id'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('salary_structure_components');
    }
};
