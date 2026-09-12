<?php

namespace App\Http\Controllers\Api\V1\Billing;

use App\Models\Invoice;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

class InvoiceController
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Invoice::class);

        $invoices = Invoice::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->withCount('paymentTransactions')
            ->orderByDesc('billing_period_start')
            ->paginate($request->input('per_page', 15));

        return response()->json(['data' => $invoices]);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        $this->authorize('view', $invoice);

        return response()->json(['data' => $invoice->load('paymentTransactions')]);
    }
}
