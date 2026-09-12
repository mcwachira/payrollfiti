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
        Schema::create('statutory_rule_sets', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('country', 2);

            $table->string('name');

            $table->string('version');

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->string('status')->default('active');

            $table->jsonb('configuration');

            $table->timestampsTz();

            $table->unique([
                'country',
                'version'
            ]);

            $table->index([
                'country',
                'effective_from'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('statutory_rule_sets');
    }
};
