<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Models\Subscription;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class SubscriptionController
{
    public function show(): JsonResponse
    {
        $user = auth()->user();

        if ($user === null || ! method_exists($user, 'can') || ! ($user->can('billing.view') || $user->can('billing.manage'))) {
            throw new AuthorizationException;
        }

        $subscription = Subscription::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['plan', 'invoices'])
            ->first();

        return response()->json(['data' => $subscription]);
    }
}
