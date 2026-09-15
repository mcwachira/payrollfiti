<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A generated payslip for one payroll entry. Created exactly once per payroll
 * entry (UNIQUE payroll_entry_id) by the GeneratePayslip job, which is also
 * unique per entry at the queue layer (ShouldBeUnique) — belt and suspenders:
 * the job prevents duplicate dispatch, the database constraint prevents
 * duplicate rows regardless of dispatch behavior.
 *
 * Tenant isolation is inherited from the owning payroll entry (payslips table
 * intentionally carries no tenant_id column); a payslip is only ever reachable
 * through a payroll entry the tenant owns.
 */
class Payslip extends Model
{
    use HasUuids;

    protected $table = 'payslips';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'payroll_entry_id',
        'payslip_number',
        'status',
        'storage_disk',
        'storage_path',
        'file_hash',
        'generated_at',
    ];

    protected $casts = [
        'generated_at' => 'datetime',
    ];

    public function payrollEntry(): BelongsTo
    {
        return $this->belongsTo(PayrollEntry::class, 'payroll_entry_id');
    }
}
