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
        Schema::create('payroll_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('company_id')
                ->unique()
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('frequency')->default('monthly');

            $table->string('currency', 3);

            $table->foreignUuid('default_rule_set_id')
                ->nullable()
                ->constrained('statutory_rule_sets')
                ->nullOnDelete();

            $table->jsonb('configuration')->nullable();

            $table->timestampsTz();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_settings');
    }
};
