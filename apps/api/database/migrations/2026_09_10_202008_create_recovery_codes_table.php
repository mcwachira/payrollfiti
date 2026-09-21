<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recovery_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('two_factor_authentication_id')
                ->constrained('two_factor_authentications')
                ->cascadeOnDelete();

            $table->string('code_hash', 64)->unique();

            $table->timestampTz('used_at')->nullable();

            $table->timestampsTz();

            $table->index([
                'two_factor_authentication_id',
                'used_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recovery_codes');
    }
};
