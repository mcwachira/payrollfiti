<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_sync_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('accounting_connection_id')
                ->constrained('accounting_connections')
                ->restrictOnDelete();

            $table->string('entity_type');

            $table->string('status')->default('pending');

            $table->timestampTz('started_at')->nullable();

            $table->timestampTz('completed_at')->nullable();

            $table->text('error')->nullable();

            $table->jsonb('filters')->nullable();

            $table->timestampsTz();

            $table->index([
                'tenant_id',
                'status',
            ]);

            $table->index([
                'accounting_connection_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_sync_jobs');
    }
};
