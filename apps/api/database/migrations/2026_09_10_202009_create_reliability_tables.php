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
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('key');
            $table->char('request_hash', 64);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->jsonb('response_headers')->nullable();
            $table->jsonb('response_body')->nullable();
            $table->timestampTz('locked_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();
            $table->unique(['tenant_id', 'key']);
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('outbox_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('event_type');
            $table->string('aggregate_type')->nullable();
            $table->uuid('aggregate_id')->nullable();
            $table->jsonb('payload');
            $table->timestampTz('available_at')->nullable();
            $table->timestampTz('dispatched_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestampsTz();
            $table->index(['dispatched_at', 'available_at']);
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('auditable_type')->nullable();
            $table->uuid('auditable_id')->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('correlation_id')->nullable();
            $table->timestampTz('created_at');
            $table->index(['tenant_id', 'created_at']);
            $table->index(['auditable_type', 'auditable_id']);
        });

        Schema::create('report_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('report_type');
            $table->string('status')->default('pending');
            $table->jsonb('filters')->nullable();
            $table->string('disk')->nullable();
            $table->string('path')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->text('error')->nullable();
            $table->timestampsTz();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('export_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('export_type');
            $table->string('format');
            $table->string('status')->default('pending');
            $table->jsonb('filters')->nullable();
            $table->string('disk')->nullable();
            $table->string('path')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->text('error')->nullable();
            $table->timestampsTz();
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('export_jobs');
        Schema::dropIfExists('report_jobs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('outbox_events');
        Schema::dropIfExists('idempotency_keys');
    }
};
