<?php

namespace App\Policies;

use App\Models\PaymentTransaction;
use App\Models\User;

class PaymentTransactionPolicy
{
    public function view(User $user, PaymentTransaction $payment): bool
    {
        return $payment->tenant_id === $user->tenant_id
            && ($user->can('billing.view') || $user->can('billing.manage'));
    }
}
