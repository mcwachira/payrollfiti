<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(
            'ALTER TABLE "compliance_reports" ENABLE ROW LEVEL SECURITY'
        );

        DB::statement(
            'ALTER TABLE "compliance_reports" FORCE ROW LEVEL SECURITY'
        );

        DB::statement(
            'CREATE POLICY "compliance_reports_tenant_isolation"
             ON "compliance_reports"
             USING (
                 tenant_id =
                 NULLIF(
                     current_setting(\'app.current_tenant_id\', true),
                     \'\'
                 )::uuid
             )
             WITH CHECK (
                 tenant_id =
                 NULLIF(
                     current_setting(\'app.current_tenant_id\', true),
                     \'\'
                 )::uuid
             )'
        );
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(
            'DROP POLICY IF EXISTS "compliance_reports_tenant_isolation"
             ON "compliance_reports"'
        );

        DB::statement(
            'ALTER TABLE "compliance_reports" NO FORCE ROW LEVEL SECURITY'
        );

        DB::statement(
            'ALTER TABLE "compliance_reports" DISABLE ROW LEVEL SECURITY'
        );
    }
};
