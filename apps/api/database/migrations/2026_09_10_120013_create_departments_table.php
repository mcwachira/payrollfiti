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
        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('name');
            $table->string('code')->nullable();

            $table->foreignUuid('parent_id')
                ->nullable();

            $table->timestampsTz();

            $table->unique([
                'company_id',
                'name'
            ]);
        });

        Schema::table('departments', function (Blueprint $table): void {
            $table->foreign('parent_id')
                ->references('id')
                ->on('departments')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('departments');
    }
};
