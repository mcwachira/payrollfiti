<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('billing.view') || $user->can('billing.manage');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $this->canAccessTenant($user, $invoice)
            && ($user->can('billing.view') || $user->can('billing.manage'));
    }

    public function pay(User $user, Invoice $invoice): bool
    {
        return $this->canAccessTenant($user, $invoice)
            && $user->can('billing.manage');
    }

    protected function canAccessTenant(User $user, Invoice $invoice): bool
    {
        return $invoice->tenant_id === $user->tenant_id;
    }
}
