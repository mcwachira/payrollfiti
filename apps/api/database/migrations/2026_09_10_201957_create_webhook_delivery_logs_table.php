<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_delivery_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('webhook_endpoint_id')
                ->constrained('webhook_endpoints')
                ->cascadeOnDelete();

            $table->string('event_type');

            /*
             * Every outbound event gets a stable event ID.
             * This is part of webhook delivery idempotency.
             */
            $table->string('event_id');

            $table->string('status')->default('pending');

            $table->unsignedSmallInteger('attempts')->default(0);

            $table->unsignedSmallInteger('response_status')->nullable();

            $table->unsignedInteger('response_time_ms')->nullable();

            $table->text('response_body')->nullable();

            $table->text('error')->nullable();

            $table->timestampTz('delivered_at')->nullable();

            $table->timestampTz('next_attempt_at')->nullable();

            $table->timestampsTz();

            $table->unique([
                'webhook_endpoint_id',
                'event_type',
                'event_id',
            ], 'webhook_delivery_logs_idempotency_unique');

            $table->index([
                'webhook_endpoint_id',
                'created_at',
            ]);

            $table->index([
                'tenant_id',
                'status',
                'next_attempt_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_delivery_logs');
    }
};
