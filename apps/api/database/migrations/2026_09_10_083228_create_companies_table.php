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
        Schema::create('companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('legal_name')->nullable();

            $table->string('registration_number')->nullable();
            $table->string('tax_number')->nullable();

            $table->string('country', 2);
            $table->string('currency', 3);

            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->jsonb('address')->nullable();

            $table->string('status')->default('active');

            $table->timestampsTz();
            $table->softDeletesTz();

            $table->unique([
                'tenant_id',
                'registration_number'
            ]);

            $table->index([
                'tenant_id',
                'status'
            ]);
        });
            }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
