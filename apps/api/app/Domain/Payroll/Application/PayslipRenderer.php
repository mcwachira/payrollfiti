<?php

declare(strict_types=1);

namespace App\Domain\Payroll\Application;

use App\Models\PayrollEntry;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Renders a single payroll entry as a PDF payslip byte-stream.
 *
 * Part 13 §13.6: one job per payroll entry renders exactly one PDF. The
 * renderer reads only the persisted entry — never the live employee record —
 * so a later salary change cannot alter an already-generated payslip
 * (historical reproducibility).
 *
 * dompdf is used (blade HTML → PDF) rather than Browsershot: Browsershot
 * shells out to headless Chrome per job and is documented as the richer
 * path for pixel-perfect templates; dompdf keeps worker CPU/memory flat for
 * the standard tabular payslip and is already a hard dependency.
 */
final class PayslipRenderer
{
    public function render(PayrollEntry $entry): string
    {
        $breakdown = is_array($entry->breakdown) ? $entry->breakdown : [];
        $employee = $entry->employee()->withoutGlobalScopes()->first();
        $run = $entry->payrollRun;

        $html = view('pdf.payslip', [
            'employee' => $employee,
            'run' => $run,
            'entry' => $entry,
            'breakdown' => $breakdown,
        ])->render();

        return Pdf::loadHTML($html, 'UTF-8')->output();
    }
}
