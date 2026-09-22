<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('name');

            $table->string('timezone')
                ->default('Africa/Nairobi');

            $table->jsonb('schedule');

            $table->unsignedSmallInteger('grace_minutes')
                ->default(0);

            $table->boolean('active')->default(true);

            $table->timestampsTz();

            $table->unique([
                'company_id',
                'name',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_policies');
    }
};
