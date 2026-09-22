<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('key');

            $table->char('request_hash', 64);

            $table->unsignedSmallInteger('response_status')->nullable();

            $table->jsonb('response_headers')->nullable();

            $table->jsonb('response_body')->nullable();

            $table->timestampTz('locked_at')->nullable();

            $table->timestampTz('completed_at')->nullable();

            $table->timestampsTz();

            $table->unique([
                'tenant_id',
                'key',
            ]);

            $table->index([
                'tenant_id',
                'created_at',
            ]);

            $table->index([
                'tenant_id',
                'completed_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
