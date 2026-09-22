<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outbox_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->nullable()
                ->constrained('tenants')
                ->nullOnDelete();

            $table->string('event_type');

            $table->string('aggregate_type')->nullable();

            $table->uuid('aggregate_id')->nullable();

            $table->jsonb('payload');

            $table->timestampTz('available_at')->nullable();

            $table->timestampTz('dispatched_at')->nullable();

            $table->unsignedSmallInteger('attempts')->default(0);

            $table->text('last_error')->nullable();

            $table->timestampsTz();

            $table->index([
                'dispatched_at',
                'available_at',
            ]);

            $table->index([
                'tenant_id',
                'created_at',
            ]);

            $table->index([
                'event_type',
                'dispatched_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outbox_events');
    }
};
