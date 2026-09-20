<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->foreignUuid('department_id')
                ->nullable()
                ->constrained('departments')
                ->nullOnDelete();

            $table->string('name');
            $table->string('code')->nullable();

            $table->timestampsTz();

            $table->unique([
                'company_id',
                'name',
            ]);

            $table->unique([
                'company_id',
                'code',
            ]);

            $table->index([
                'company_id',
                'department_id',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};
