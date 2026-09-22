<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_endpoints', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->string('name');

            $table->text('url');

            $table->string('secret_hash', 64);

            $table->text('secret_ciphertext');

            $table->jsonb('events');

            $table->string('status')->default('active');

            $table->timestampTz('last_delivered_at')->nullable();

            $table->timestampsTz();

            $table->unique([
                'tenant_id',
                'name',
            ]);

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_endpoints');
    }
};
