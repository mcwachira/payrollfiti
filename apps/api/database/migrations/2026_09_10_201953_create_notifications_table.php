<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignUuid('template_id')
                ->nullable()
                ->constrained('notification_templates')
                ->nullOnDelete();

            $table->string('event_type');

            /*
             * Deterministic idempotency key.
             *
             * Example:
             * tenant + user + event + entity
             */
            $table->string('dedupe_hash', 64)->nullable();

            $table->string('title');
            $table->text('body');

            $table->jsonb('data')->nullable();

            $table->timestampTz('read_at')->nullable();

            $table->timestampsTz();

            $table->unique(
                ['tenant_id', 'dedupe_hash'],
                'notifications_tenant_dedupe_hash_unique',
            );

            $table->index([
                'tenant_id',
                'user_id',
                'read_at',
            ]);

            $table->index([
                'tenant_id',
                'event_type',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
