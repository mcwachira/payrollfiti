<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Payroll\Application\PayslipRenderer;
use App\Models\PayrollEntry;
use App\Models\Payslip;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Render one payroll entry to a PDF payslip and persist it to object storage.
 *
 * Guarantees (Part 13 §13.3 / §13.4):
 *  - Exactly one payslip per payroll entry: UNIQUE payroll_entry_id at the
 *    database layer AND ShouldBeUnique at the queue layer.
 *  - Idempotent: a retry that finds an already-generated payslip is a no-op.
 *  - Retry-safe: any transient render/storage error retries up to $tries with
 *    exponential backoff; after exhaustion failed() dead-letters the specific
 *    payslip so HR can see and retry it manually — never silently dropped.
 */
final class GeneratePayslip extends TenantAwareJob implements ShouldBeUnique
{
    public string $payrollEntryId;

    public function __construct(string $tenantId, string $payrollEntryId)
    {
        $this->tenantId = $tenantId;
        $this->payrollEntryId = $payrollEntryId;
        $this->timeout = 120;
        $this->onQueue('payroll');
    }

    public function uniqueId(): string
    {
        return $this->payrollEntryId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function middleware(): array
    {
        return [new WithoutOverlapping($this->payrollEntryId)];
    }

    protected function execute(): void
    {
        $entry = PayrollEntry::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->with(['payrollRun.company', 'employee'])
            ->find($this->payrollEntryId);

        if ($entry === null) {
            // Entry deleted between dispatch and execution — nothing to generate.
            Log::warning('generate_payslip.entry_missing', [
                'tenant_id' => $this->tenantId,
                'payroll_entry_id' => $this->payrollEntryId,
            ]);

            $this->delete();

            return;
        }

        $payslip = Payslip::firstOrCreate(
            ['payroll_entry_id' => $entry->id],
            ['payslip_number' => 'PSP-'.$entry->id, 'status' => 'generating'],
        );

        if ($payslip->status === 'generated' && $payslip->storage_path !== null) {
            return; // idempotent no-op
        }

        $payslip->update(['status' => 'generating']);

        $disk = Storage::disk('payslips');
        $path = sprintf(
            'tenants/%s/payslips/%s/%s.pdf',
            $this->tenantId,
            $entry->payroll_run_id,
            $payslip->id,
        );

        $pdf = app(PayslipRenderer::class)->render($entry);
        $disk->put($path, $pdf);

        $payslip->update([
            'status' => 'generated',
            'storage_disk' => 'payslips',
            'storage_path' => $path,
            'file_hash' => hash('sha256', $pdf),
            'generated_at' => now(),
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        // Dead-letter bookkeeping: mark the specific payslip failed so it is
        // visible and retriable from the payroll-run detail page.
        Payslip::where('payroll_entry_id', $this->payrollEntryId)
            ->update([
                'status' => 'failed',
                'generated_at' => null,
            ]);

        Log::error('generate_payslip.failed', [
            'tenant_id' => $this->tenantId,
            'payroll_entry_id' => $this->payrollEntryId,
            'error' => $exception->getMessage(),
        ]);
    }
}
