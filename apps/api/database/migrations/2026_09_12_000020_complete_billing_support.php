<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Billing support:
 *  - partial unique index so automated subscription renewal is idempotent
 *    (one invoice per subscription billing period);
 *  - permissive, null-tenant RLS policies on payment_provider_events so the
 *    unauthenticated provider webhook endpoint can INSERT inbound events and
 *    the queue worker can SELECT/UPDATE them with no tenant context.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'CREATE UNIQUE INDEX IF NOT EXISTS invoices_subscription_billing_period_uq
                 ON invoices (subscription_id, billing_period_start)
                 WHERE subscription_id IS NOT NULL'
            );

            DB::statement(
                'CREATE POLICY payment_provider_events_null_tenant_select
                 ON payment_provider_events
                 FOR SELECT
                 TO PUBLIC
                 USING (tenant_id IS NULL)'
            );

            DB::statement(
                'CREATE POLICY payment_provider_events_null_tenant_insert
                 ON payment_provider_events
                 FOR INSERT
                 TO PUBLIC
                 WITH CHECK (tenant_id IS NULL)'
            );

            DB::statement(
                'CREATE POLICY payment_provider_events_null_tenant_update
                 ON payment_provider_events
                 FOR UPDATE
                 TO PUBLIC
                 USING (tenant_id IS NULL)'
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP POLICY IF EXISTS payment_provider_events_null_tenant_update ON payment_provider_events');
            DB::statement('DROP POLICY IF EXISTS payment_provider_events_null_tenant_insert ON payment_provider_events');
            DB::statement('DROP POLICY IF EXISTS payment_provider_events_null_tenant_select ON payment_provider_events');
        }

        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function ($table): void {
                $table->dropUnique('invoices_subscription_billing_period_uq');
            });
        }
    }
};
