<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->unique()->constrained('tenants')->cascadeOnDelete();
            $table->foreignUuid('plan_id')->constrained('plans');
            $table->string('status')->default('trialing');

            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at')->nullable();
            $table->timestampTz('trial_ends_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();

            $table->string('provider')->nullable();
            $table->string('provider_subscription_id')->nullable();

            $table->jsonb('metadata')->nullable();

            $table->timestampsTz();

            $table->unique([
                'provider',
                'provider_subscription_id'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
