<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('name');

            $table->string('prefix', 16);

            $table->string('secret_hash', 64);

            $table->string('status')->default('active');

            $table->timestampTz('last_used_at')->nullable();

            $table->timestampTz('expires_at')->nullable();

            $table->timestampTz('revoked_at')->nullable();

            $table->timestampsTz();

            $table->unique([
                'tenant_id',
                'prefix',
            ]);

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_keys');
    }
};
