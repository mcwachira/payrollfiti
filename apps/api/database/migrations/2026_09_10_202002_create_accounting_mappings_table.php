<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_mappings', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('accounting_connection_id')
                ->constrained('accounting_connections')
                ->cascadeOnDelete();

            $table->string('entity_type');

            $table->string('local_code');

            $table->string('external_code');

            $table->jsonb('metadata')->nullable();

            $table->timestampsTz();

            $table->unique([
                'accounting_connection_id',
                'entity_type',
                'local_code',
            ]);

            $table->index([
                'tenant_id',
                'entity_type',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_mappings');
    }
};
