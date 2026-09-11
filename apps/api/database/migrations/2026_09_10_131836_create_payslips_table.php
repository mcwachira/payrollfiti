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
        Schema::create('payslips', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('payroll_entry_id')
                ->unique()
                ->constrained('payroll_entries')
                ->cascadeOnDelete();

            $table->string('payslip_number')->unique();

            $table->string('status')->default('generated');

            $table->string('storage_disk')->nullable();
            $table->string('storage_path')->nullable();

            $table->string('file_hash')->nullable();

            $table->timestampTz('generated_at')->nullable();

            $table->timestampsTz();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payslips');
    }
};

