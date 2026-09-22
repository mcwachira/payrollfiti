<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * LoanProduct — the approval/pricing template a Loan draws its terms from.
 *
 * Part 15 §15.2. Company-level configuration: maximum principal, annual
 * interest rate, and maximum term. `rules` carries product-specific defaults
 * (e.g. repayment_method = payroll_deduction) used when a schedule is
 * generated at loan approval time.
 */
class LoanProduct extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'maximum_principal',
        'annual_interest_rate',
        'maximum_term_months',
        'active',
        'rules',
    ];

    protected $casts = [
        'maximum_principal' => 'decimal:2',
        'annual_interest_rate' => 'decimal:4',
        'active' => 'boolean',
        'rules' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class, 'loan_product_id');
    }
}
