<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->restrictOnDelete();
            $table->foreignUuid('subscription_id')->nullable()->constrained('subscriptions')->nullOnDelete();
            $table->string('invoice_number');
            $table->string('status')->default('draft');
            $table->date('billing_period_start');
            $table->date('billing_period_end');
            $table->decimal('subtotal', 18, 2)->default(0);
            $table->decimal('tax', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->default(0);
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
            $table->index(['tenant_id', 'status', 'due_at']);
        });

        Schema::create('usage_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->restrictOnDelete();
            $table->foreignUuid('subscription_id')->nullable()->constrained('subscriptions')->nullOnDelete();
            $table->string('metric');
            $table->decimal('quantity', 18, 4)->default(0);
            $table->string('unit')->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->jsonb('metadata')->nullable();
            $table->timestampsTz();
            $table->unique(['tenant_id', 'metric', 'period_start', 'period_end']);
        });

        Schema::create('payment_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->restrictOnDelete();
            $table->foreignUuid('invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->string('provider');
            $table->string('provider_transaction_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3);
            $table->timestampTz('completed_at')->nullable();
            $table->jsonb('provider_response')->nullable();
            $table->timestampsTz();
            $table->unique(['provider', 'provider_transaction_id']);
            $table->unique(['tenant_id', 'idempotency_key']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('payment_provider_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('provider');
            $table->string('provider_event_id');
            $table->string('event_type');
            $table->jsonb('payload');
            $table->string('status')->default('received');
            $table->timestampTz('processed_at')->nullable();
            $table->text('processing_error')->nullable();
            $table->timestampsTz();
            $table->unique(['provider', 'provider_event_id']);
            $table->index(['provider', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_provider_events');
        Schema::dropIfExists('payment_transactions');
        Schema::dropIfExists('usage_records');
        Schema::dropIfExists('invoices');
    }
};
