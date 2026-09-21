<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_provider_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->nullable()
                ->constrained('tenants')
                ->nullOnDelete();

            $table->string('provider');

            $table->string('provider_event_id');

            $table->string('event_type');

            $table->jsonb('payload');

            $table->string('status')->default('received');

            $table->timestampTz('processed_at')->nullable();

            $table->text('processing_error')->nullable();

            $table->timestampsTz();

            $table->unique([
                'provider',
                'provider_event_id',
            ]);

            $table->index([
                'provider',
                'status',
            ]);

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_provider_events');
    }
};
