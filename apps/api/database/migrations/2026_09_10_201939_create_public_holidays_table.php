<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('public_holidays', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->nullable()
                ->constrained('companies')
                ->nullOnDelete();

            $table->string('country', 2);
            $table->string('name');
            $table->date('holiday_date');

            $table->boolean('is_paid')->default(true);

            $table->timestampsTz();

            $table->unique([
                'tenant_id',
                'company_id',
                'holiday_date',
            ]);

            $table->index([
                'tenant_id',
                'country',
                'holiday_date',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_holidays');
    }
};
