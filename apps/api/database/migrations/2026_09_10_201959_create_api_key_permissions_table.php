<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_key_permissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('api_key_id')
                ->constrained('api_keys')
                ->cascadeOnDelete();

            $table->string('permission');

            $table->timestampsTz();

            $table->unique([
                'api_key_id',
                'permission',
            ]);

            $table->index([
                'tenant_id',
                'permission',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_key_permissions');
    }
};
