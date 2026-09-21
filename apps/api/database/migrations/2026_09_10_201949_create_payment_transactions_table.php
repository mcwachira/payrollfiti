<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->restrictOnDelete();

            $table->foreignUuid('invoice_id')
                ->nullable()
                ->constrained('invoices')
                ->restrictOnDelete();

            $table->string('provider');

            $table->string('provider_transaction_id')->nullable();

            $table->string('idempotency_key')->nullable();

            $table->string('status')->default('pending');

            $table->decimal('amount', 18, 2);

            $table->string('currency', 3);

            $table->timestampTz('completed_at')->nullable();

            $table->jsonb('provider_response')->nullable();

            $table->timestampsTz();

            $table->unique([
                'provider',
                'provider_transaction_id',
            ]);

            $table->unique([
                'tenant_id',
                'idempotency_key',
            ]);

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
