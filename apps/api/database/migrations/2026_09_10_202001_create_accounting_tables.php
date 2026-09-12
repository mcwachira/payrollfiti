<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_connections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('provider');
            $table->string('status')->default('active');
            $table->text('access_token_encrypted')->nullable();
            $table->text('refresh_token_encrypted')->nullable();
            $table->timestampTz('token_expires_at')->nullable();
            $table->string('external_account_id')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestampsTz();
            $table->unique(['company_id', 'provider']);
        });

        Schema::create('accounting_mappings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('accounting_connection_id')->constrained('accounting_connections')->cascadeOnDelete();
            $table->string('entity_type');
            $table->string('local_code');
            $table->string('external_code');
            $table->jsonb('metadata')->nullable();
            $table->timestampsTz();
            $table->unique(['accounting_connection_id', 'entity_type', 'local_code']);
        });

        Schema::create('accounting_sync_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('accounting_connection_id')->constrained('accounting_connections')->restrictOnDelete();
            $table->string('entity_type');
            $table->string('status')->default('pending');
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->text('error')->nullable();
            $table->jsonb('filters')->nullable();
            $table->timestampsTz();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('accounting_sync_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('accounting_sync_job_id')->constrained('accounting_sync_jobs')->cascadeOnDelete();
            $table->string('entity_type');
            $table->string('local_id');
            $table->string('external_id')->nullable();
            $table->string('status');
            $table->text('error')->nullable();
            $table->jsonb('response')->nullable();
            $table->timestampsTz();
            $table->unique(['accounting_sync_job_id', 'entity_type', 'local_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_sync_records');
        Schema::dropIfExists('accounting_sync_jobs');
        Schema::dropIfExists('accounting_mappings');
        Schema::dropIfExists('accounting_connections');
    }
};
