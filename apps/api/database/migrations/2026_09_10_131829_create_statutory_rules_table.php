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
        Schema::create('statutory_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('rule_set_id')
                ->constrained('statutory_rule_sets')
                ->cascadeOnDelete();

            $table->string('code');
            $table->string('name');

            $table->string('type');

            $table->jsonb('configuration');

            $table->timestampsTz();

            $table->unique([
                'rule_set_id',
                'code'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('statutory_rules');
    }
};
