<?php

namespace App\Http\Controllers\Api\V1\Loan;

use App\Domain\Loans\Services\LoanService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Loan\ApproveLoanRequest;
use App\Http\Requests\Api\V1\Loan\CreateLoanRequest;
use App\Http\Requests\Api\V1\Loan\RejectLoanRequest;
use App\Http\Resources\LoanResource;
use App\Models\Loan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoanController extends Controller
{
    public function __construct(
        private readonly LoanService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Loan::class);

        $query = Loan::query()
            ->where('tenant_id', $request->user()->tenant_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return LoanResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function store(CreateLoanRequest $request): JsonResponse
    {
        $this->authorize('create', Loan::class);

        $data = $request->validated();
        $data['tenant_id'] = $request->user()->tenant_id;

        $employee = \App\Models\Employee::query()
            ->where('tenant_id', $data['tenant_id'])
            ->whereKey($data['employee_id'])
            ->first();

        if ($employee) {
            $data['company_id'] = $employee->company_id;
        }

        $product = \App\Models\LoanProduct::query()
            ->where('tenant_id', $data['tenant_id'])
            ->whereKey($data['loan_product_id'])
            ->first();

        $principal = (float) $data['principal_amount'];
        $termMonths = (int) $data['term_months'];
        $annualRate = $product ? (float) $product->annual_interest_rate : 0;
        $monthlyRate = $annualRate / 12 / 100;
        $totalInterest = round($principal * $monthlyRate * $termMonths, 2);

        $data['interest_amount'] = $totalInterest;
        $data['total_amount'] = round($principal + $totalInterest, 2);
        $data['outstanding_amount'] = $data['total_amount'];
        $data['status'] = 'pending';

        $loan = Loan::create($data);

        return (new LoanResource($loan))->response()->setStatusCode(201);
    }

    public function show(Loan $loan): JsonResponse
    {
        $this->authorize('view', $loan);

        return new LoanResource($loan);
    }

    public function approve(ApproveLoanRequest $request, Loan $loan): JsonResponse
    {
        $this->authorize('update', $loan);

        if ($loan->status === 'active') {
            return response()->json(['message' => 'Loan is already approved.'], 422);
        }

        $this->service->approve($loan, $request->user(), $request->input('notes'));

        return (new LoanResource($loan->fresh()))->response();
    }

    public function reject(RejectLoanRequest $request, Loan $loan): JsonResponse
    {
        $this->authorize('update', $loan);

        if ($loan->status === 'rejected') {
            return response()->json(['message' => 'Loan is already rejected.'], 422);
        }

        $this->service->reject($loan, $request->user(), $request->input('notes'));

        return (new LoanResource($loan->fresh()))->response();
    }

    public function myLoans(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;

        if (!$employee) {
            return response()->json([]);
        }

        $query = Loan::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('employee_id', $employee->id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return LoanResource::collection($query->latest()->paginate($request->input('per_page', 15)));
    }

    public function payoff(Request $request, Loan $loan): JsonResponse
    {
        $this->authorize('update', $loan);

        $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        $loan = $this->service->payoff($loan, $request->input('amount'));

        return new LoanResource($loan->fresh());
    }
}
