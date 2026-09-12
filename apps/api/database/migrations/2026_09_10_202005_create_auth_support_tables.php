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
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignUuid('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('token_hash')->unique();
            $table->string('status')->default('pending');
            $table->timestampTz('expires_at');
            $table->timestampTz('accepted_at')->nullable();
            $table->timestampsTz();
            $table->index(['tenant_id', 'email', 'status']);
        });

        Schema::create('user_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('session_hash')->unique();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestampTz('last_active_at')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();
            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('two_factor_authentications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('secret_encrypted');
            $table->boolean('enabled')->default(false);
            $table->timestampTz('confirmed_at')->nullable();
            $table->timestampsTz();
            $table->unique('user_id');
        });

        Schema::create('recovery_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('two_factor_authentication_id')->constrained('two_factor_authentications')->cascadeOnDelete();
            $table->string('code_hash')->unique();
            $table->timestampTz('used_at')->nullable();
            $table->timestampsTz();
            $table->index(['two_factor_authentication_id', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recovery_codes');
        Schema::dropIfExists('two_factor_authentications');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('invitations');
    }
};
