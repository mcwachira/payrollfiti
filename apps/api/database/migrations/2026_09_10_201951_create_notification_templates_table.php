<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->nullable()
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->string('code');
            $table->string('channel');
            $table->string('subject')->nullable();
            $table->text('body');
            $table->jsonb('variables')->nullable();
            $table->boolean('active')->default(true);

            $table->timestampsTz();

            // Tenant-specific template uniqueness.
            $table->unique(
                ['tenant_id', 'code', 'channel'],
                'notification_templates_tenant_unique',
            );

            $table->index([
                'tenant_id',
                'code',
                'channel',
                'active',
            ]);

            // Only one platform-wide template for a code/channel.

            $table->unique([
                'tenant_id',
                'code',
                'channel',
            ]);
        });



    }

    public function down(): void
    {
        Schema::dropIfExists('notification_templates');
    }
};
