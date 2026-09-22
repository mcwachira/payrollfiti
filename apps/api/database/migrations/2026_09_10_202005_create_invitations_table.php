<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->nullable()
                ->constrained('companies')
                ->nullOnDelete();

            $table->foreignUuid('invited_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('email');

            $table->string('token_hash', 64)->unique();

            $table->string('status')->default('pending');

            $table->timestampTz('expires_at');

            $table->timestampTz('accepted_at')->nullable();

            $table->timestampsTz();

            $table->index([
                'tenant_id',
                'email',
                'status',
            ]);

            $table->index([
                'tenant_id',
                'status',
                'expires_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
