<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('export_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('requested_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('export_type');

            $table->string('format');

            $table->string('status')->default('pending');

            $table->jsonb('filters')->nullable();

            $table->string('disk')->nullable();

            $table->text('path')->nullable();

            $table->timestampTz('completed_at')->nullable();

            $table->timestampTz('expires_at')->nullable();

            $table->text('error')->nullable();

            $table->timestampsTz();

            $table->index([
                'tenant_id',
                'status',
                'created_at',
            ]);

            $table->index([
                'tenant_id',
                'expires_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('export_jobs');
    }
};
