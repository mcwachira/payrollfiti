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
        Schema::create('payroll_entry_items', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('payroll_entry_id')
                ->constrained('payroll_entries')
                ->cascadeOnDelete();

            $table->foreignUuid('salary_component_id')
                ->nullable()
                ->constrained('salary_components')
                ->nullOnDelete();

            $table->string('code');
            $table->string('name');

            $table->string('type');

            $table->decimal('amount', 18, 2);

            $table->jsonb('calculation_metadata')->nullable();

            $table->timestampsTz();

            $table->index([
                'payroll_entry_id',
                'type'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_entry_items');
    }
};
