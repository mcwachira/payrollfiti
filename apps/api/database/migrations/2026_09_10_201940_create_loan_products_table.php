<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_products', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->foreignUuid('tenant_id')
                ->constrained('tenants')
                ->cascadeOnDelete();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->string('name');
            $table->string('code');

            $table->decimal('maximum_principal', 18, 2)->nullable();
            $table->decimal('annual_interest_rate', 8, 4)->default(0);

            $table->unsignedSmallInteger('maximum_term_months')
                ->nullable();

            $table->boolean('active')->default(true);

            $table->jsonb('rules')->nullable();

            $table->timestampsTz();

            $table->unique([
                'company_id',
                'code',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_products');
    }
};
