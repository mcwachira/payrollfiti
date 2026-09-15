<?php

declare(strict_types=1);

namespace App\Domain\Accounting\Contracts;

use App\Models\PayrollRun;

interface AccountingProvider
{
    public function name(): string;

    public function syncPayrollRun(PayrollRun $run, array $mappings): SyncResult;

    public function syncInvoice(object $invoice, array $mappings): SyncResult;
}
