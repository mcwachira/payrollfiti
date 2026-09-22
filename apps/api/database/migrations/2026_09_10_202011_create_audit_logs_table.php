<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('action');

            $table->string('auditable_type')->nullable();

            $table->uuid('auditable_id')->nullable();

            $table->jsonb('old_values')->nullable();

            $table->jsonb('new_values')->nullable();

            $table->string('ip_address', 45)->nullable();

            $table->text('user_agent')->nullable();

            $table->string('correlation_id')->nullable();

            $table->timestampTz('created_at')->useCurrent();

            $table->index([
                'tenant_id',
                'created_at',
            ]);

            $table->index([
                'tenant_id',
                'user_id',
                'created_at',
            ]);

            $table->index([
                'auditable_type',
                'auditable_id',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
