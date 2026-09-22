<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('notification_id')
                ->constrained('notifications')
                ->cascadeOnDelete();

            $table->string('channel');

            $table->string('status')->default('pending');

            $table->unsignedSmallInteger('attempts')->default(0);

            $table->timestampTz('sent_at')->nullable();
            $table->timestampTz('failed_at')->nullable();

            $table->text('last_error')->nullable();

            $table->timestampsTz();

            $table->unique(
                ['notification_id', 'channel'],
                'notification_deliveries_notification_channel_unique',
            );

            $table->index([
                'tenant_id',
                'status',
            ]);

            $table->index([
                'tenant_id',
                'channel',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_deliveries');
    }
};
