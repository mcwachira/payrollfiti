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
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('url');
            $table->string('secret_hash');
            $table->jsonb('events');
            $table->string('status')->default('active');
            $table->timestampTz('last_delivered_at')->nullable();
            $table->timestampsTz();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('webhook_delivery_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('webhook_endpoint_id')->constrained('webhook_endpoints')->cascadeOnDelete();
            $table->string('event_type');
            $table->string('event_id')->nullable();
            $table->string('status')->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->text('response_body')->nullable();
            $table->text('error')->nullable();
            $table->timestampTz('delivered_at')->nullable();
            $table->timestampTz('next_attempt_at')->nullable();
            $table->timestampsTz();
            $table->index(['webhook_endpoint_id', 'created_at']);
            $table->index(['tenant_id', 'status', 'next_attempt_at']);
        });

        Schema::create('api_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('prefix', 16);
            $table->string('secret_hash');
            $table->string('status')->default('active');
            $table->timestampTz('last_used_at')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();
            $table->unique(['tenant_id', 'prefix']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('api_key_permissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('api_key_id')->constrained('api_keys')->cascadeOnDelete();
            $table->string('permission');
            $table->timestampsTz();
            $table->unique(['api_key_id', 'permission']);
        });

        Schema::create('api_key_usage', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('api_key_id')->constrained('api_keys')->cascadeOnDelete();
            $table->string('endpoint');
            $table->string('method', 10);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->timestampTz('used_at');
            $table->timestampsTz();
            $table->index(['api_key_id', 'used_at']);
            $table->index(['tenant_id', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_key_usage');
        Schema::dropIfExists('api_key_permissions');
        Schema::dropIfExists('api_keys');
        Schema::dropIfExists('webhook_delivery_logs');
        Schema::dropIfExists('webhook_endpoints');
    }
};
