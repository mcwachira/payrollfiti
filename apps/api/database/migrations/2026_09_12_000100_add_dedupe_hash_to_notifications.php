<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Part 14: idempotency support for notifications.
     *
     * Every notification row gets an optional dedupe hash (sha256 of
     * tenant|user|event_type|entity_type|entity_id) so retried listeners and
     * duplicate webhooks never create duplicate bell entries. The hash is only
     * set when the event carries a stable entity (e.g. payroll run, payment
     * transaction, report); events without one are never deduped.
     *
     * A NULL dedupe_hash is treated as a new row (Postgres NULL != NULL), so
     * the unique tenant+hash guard cannot collide for non-deduped events.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->char('dedupe_hash', 64)->nullable()->after('event_type');
            $table->unique(['tenant_id', 'dedupe_hash']);
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropUnique(['tenant_id', 'dedupe_hash']);
            $table->dropColumn('dedupe_hash');
        });
    }
};
