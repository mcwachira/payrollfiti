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

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('provider');

            $table->string('status')->default('active');

            $table->text('access_token_encrypted')->nullable();

            $table->text('refresh_token_encrypted')->nullable();

            $table->timestampTz('token_expires_at')->nullable();

            $table->string('external_account_id')->nullable();

            $table->jsonb('metadata')->nullable();

            $table->timestampsTz();

            $table->unique([
                'company_id',
                'provider',
            ]);

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_connections');
    }
};
