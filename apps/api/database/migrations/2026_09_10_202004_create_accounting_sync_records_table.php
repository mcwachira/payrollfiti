<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_sync_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('accounting_sync_job_id')
                ->constrained('accounting_sync_jobs')
                ->cascadeOnDelete();

            $table->string('entity_type');

            $table->string('local_id');

            $table->string('external_id')->nullable();

            $table->string('status');

            $table->text('error')->nullable();

            $table->jsonb('response')->nullable();

            $table->timestampsTz();

            $table->unique([
                'accounting_sync_job_id',
                'entity_type',
                'local_id',
            ]);

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_sync_records');
    }
};
