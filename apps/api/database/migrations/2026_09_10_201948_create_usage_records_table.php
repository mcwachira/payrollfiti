<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usage_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->restrictOnDelete();

            $table->foreignUuid('subscription_id')
                ->nullable()
                ->constrained('subscriptions')
                ->nullOnDelete();

            $table->string('metric');

            $table->decimal('quantity', 18, 4);

            $table->string('unit');

            $table->date('period_start');
            $table->date('period_end');

            $table->jsonb('metadata')->nullable();

            $table->timestampsTz();

            $table->unique([
                'tenant_id',
                'metric',
                'period_start',
                'period_end',
            ]);

            $table->index([
                'tenant_id',
                'period_start',
                'period_end',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_records');
    }
};
