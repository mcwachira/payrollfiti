<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_key_usage', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('api_key_id')
                ->constrained('api_keys')
                ->cascadeOnDelete();

            $table->text('endpoint');

            $table->string('method', 10);

            $table->unsignedSmallInteger('response_status')->nullable();

            $table->unsignedInteger('response_time_ms')->nullable();

            $table->timestampTz('used_at');

            $table->timestampsTz();

            $table->index([
                'api_key_id',
                'used_at',
            ]);

            $table->index([
                'tenant_id',
                'used_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_key_usage');
    }
};
