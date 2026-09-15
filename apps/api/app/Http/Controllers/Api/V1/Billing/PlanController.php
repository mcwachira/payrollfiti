<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Models\Plan;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class PlanController
{
    public function index(): JsonResponse
    {
        $this->authorizeBillingView();

        $plans = Plan::query()
            ->where('status', 'active')
            ->orderBy('monthly_price')
            ->get(['id', 'name', 'slug', 'description', 'monthly_price', 'annual_price', 'included_employees', 'features']);

        return response()->json(['data' => $plans]);
    }

    private function authorizeBillingView(): void
    {
        $user = auth()->user();

        if ($user === null || ! method_exists($user, 'can') || ! ($user->can('billing.view') || $user->can('billing.manage'))) {
            throw new AuthorizationException;
        }
    }
}
