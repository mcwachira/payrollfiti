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
        Schema::create('payroll_periods', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->cascadeOnDelete();

            $table->foreignUuid('pay_schedule_id')
                ->nullable()
                ->constrained('pay_schedules')
                ->nullOnDelete();

            $table->date('period_start');
            $table->date('period_end');
            $table->date('pay_date');

            $table->string('status')->default('open');

            $table->timestampsTz();

            $table->unique([
                'company_id',
                'period_start',
                'period_end'
            ]);

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_periods');
    }
};
