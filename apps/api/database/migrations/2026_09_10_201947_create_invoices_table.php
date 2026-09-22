<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->restrictOnDelete();

            $table->foreignUuid('subscription_id')
                ->nullable()
                ->constrained('subscriptions')
                ->nullOnDelete();

            $table->string('invoice_number');

            $table->string('status')->default('draft');

            $table->date('billing_period_start');
            $table->date('billing_period_end');

            $table->decimal('subtotal', 18, 2);
            $table->decimal('tax', 18, 2)->default(0);
            $table->decimal('total', 18, 2);

            $table->string('currency', 3);

            $table->timestampTz('issued_at')->nullable();
            $table->timestampTz('due_at')->nullable();
            $table->timestampTz('paid_at')->nullable();

            $table->string('provider')->nullable();
            $table->string('provider_invoice_id')->nullable();

            $table->jsonb('line_items')->nullable();

            $table->timestampsTz();

            $table->unique(['tenant_id', 'invoice_number']);

            $table->unique(['provider', 'provider_invoice_id']);

            $table->index([
                'tenant_id',
                'status',
                'due_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
