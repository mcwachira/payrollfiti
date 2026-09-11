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
        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('name');
            $table->string('slug')->unique();

            $table->text('description')->nullable();

            $table->decimal('monthly_price', 18, 2)->default(0);
            $table->decimal('annual_price', 18, 2)->default(0);

            $table->unsignedInteger('included_employees')->default(0);

            $table->jsonb('features')->nullable();

            $table->string('status')->default('active');

            $table->timestampsTz();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
