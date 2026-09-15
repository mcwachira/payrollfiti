<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The outbox is platform-level infrastructure, not tenant-scoped.
     *
     * The blanket RLS migration (2026_09_10_202014_enable_tenant_rls) incorrectly
     * applied FORCE ROW LEVEL SECURITY to outbox_events. The outbox dispatcher
     * queries this table without any tenant context, so the policy filtered out
     * every row and broke event publishing.
     *
     * This migration removes the tenant-isolation policy from outbox_events and
     * disables FORCE RLS so the outbox relay can claim and publish events.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasTable('outbox_events')) {
            return;
        }

        DB::statement('DROP POLICY IF EXISTS "outbox_events_tenant_isolation" ON "outbox_events"');
        DB::statement('ALTER TABLE "outbox_events" NO FORCE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE "outbox_events" DISABLE ROW LEVEL SECURITY');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! Schema::hasTable('outbox_events')) {
            return;
        }

        DB::statement('ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY');
        DB::statement('ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY');
        DB::statement(sprintf(
            'CREATE POLICY "%s_tenant_isolation" ON "%s" USING (tenant_id = NULLIF(current_setting(\'app.current_tenant_id\', true), \'\')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(\'app.current_tenant_id\', true), \'\')::uuid)',
            'outbox_events',
            'outbox_events'
        ));
    }
};
