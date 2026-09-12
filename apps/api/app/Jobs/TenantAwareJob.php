<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Support\TenantContext;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Base class for every tenant-scoped queued job (Part 13 §8.4 pattern).
 *
 * Enforces the tenant-context lifecycle mechanically instead of by convention:
 *
 *   queue store (serialized job carries tenant_id)
 *       ↓
 *   worker boot()    → TenantContext::clear()   (never inherit a stale context)
 *       ↓
 *   worker handle()  → TenantContext::set(tenant_id)  (app layer + Postgres RLS)
 *       ↓                ^
 *       |                |  try { execute() } finally { clear() }
 *       ↓
 *   worker cleared → connection returned to the pool with RESET app.current_tenant_id
 *
 * The boot() hook runs on every attempt; handle() is final so subclasses cannot
 * bypass the try/finally guarantee. Subclasses implement execute().
 *
 * Retry policy defaults are tuned for provider/network transients; subclasses
 * may override `$tries`, `backoff()` and implement `failed()` for per-entity
 * dead-letter bookkeeping.
 */
abstract class TenantAwareJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** The tenant the job operates against. Public so it survives serialization. */
    public string $tenantId;

    public int $tries = 5;

    public int $maxExceptions = 3;

    public function boot(): void
    {
        // A worker process (and its pooled DB connections) is shared across jobs.
        // Clearing before each attempt guarantees no tenant leaked from a previous
        // job — even one that crashed before handle() could clear it.
        TenantContext::clear();
    }

    final public function handle(): void
    {
        if ($this->tenantId === '') {
            throw new \RuntimeException('TenantAwareJob requires a non-empty tenantId.');
        }

        TenantContext::set($this->tenantId);

        try {
            $this->execute();
        } finally {
            TenantContext::clear();
        }
    }

    public function backoff(): array
    {
        return [30, 120, 600, 1800, 7200];
    }

    /**
     * Run a callback with the tenant context re-established. Useful for queued
     * dispatchers that fan out per-entry jobs from within an already-scoped job.
     */
    protected function withTenantContext(callable $callback): mixed
    {
        TenantContext::set($this->tenantId);

        try {
            return $callback();
        } finally {
            TenantContext::clear();
        }
    }

    abstract protected function execute(): void;
}
