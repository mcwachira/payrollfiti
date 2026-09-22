<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->text('endpoint');
            $table->text('public_key');
            $table->text('auth_token');

            $table->timestampTz('last_used_at')->nullable();

            $table->timestampsTz();

            $table->unique(
                ['user_id', 'endpoint'],
                'push_subscriptions_user_endpoint_unique',
            );

            $table->index([
                'tenant_id',
                'user_id',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
