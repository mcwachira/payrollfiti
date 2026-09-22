<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * PublicHoliday — a date a tenant observes as an (optionally paid) holiday.
 *
 * Part 15 §15.1/§15.3. Used to prune leave days that fall on a holiday and to
 * classify attendance days as `holiday`. Company-nullable so a company can
 * inherit the country's statutory calendar while still overriding local days.
 */
class PublicHoliday extends Model
{
    use BelongsToTenant, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'company_id',
        'country',
        'name',
        'holiday_date',
        'is_paid',
    ];

    protected $casts = [
        'holiday_date' => 'date',
        'is_paid' => 'boolean',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }
}
