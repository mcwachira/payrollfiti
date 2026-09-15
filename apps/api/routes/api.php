<?php

use App\Http\Controllers\AccountSessionController;
use App\Http\Controllers\Api\V1\AccountingConnectionController;
use App\Http\Controllers\Api\V1\AccountingOAuthController;
use App\Http\Controllers\Api\V1\ApiKeyController;
use App\Http\Controllers\Api\V1\Attendance\AttendanceController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\Billing\InvoiceController;
use App\Http\Controllers\Api\V1\Billing\PaymentController;
use App\Http\Controllers\Api\V1\Billing\PlanController;
use App\Http\Controllers\Api\V1\Billing\SubscriptionController;
use App\Http\Controllers\Api\V1\BrandingController;
use App\Http\Controllers\Api\V1\ComplianceReportController;
use App\Http\Controllers\Api\V1\Documents\DocumentController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\Leave\LeaveRequestController;
use App\Http\Controllers\Api\V1\Leave\LeaveTypeController;
use App\Http\Controllers\Api\V1\Loan\LoanController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\Onboarding\OnboardingTaskController;
use App\Http\Controllers\Api\V1\PayrollCalculatorController;
use App\Http\Controllers\Api\V1\PayrollRunController;
use App\Http\Controllers\Api\V1\PushSubscriptionController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\WebhookEndpointController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('v1/webhooks/{provider}', [WebhookController::class, 'handle']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Part 14 — notification centre (flat / namespace, matches apps/web client).
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/{notification}', [NotificationController::class, 'show']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    Route::get('/notification-preferences', [NotificationPreferenceController::class, 'index']);
    Route::put('/notification-preferences', [NotificationPreferenceController::class, 'update']);

    Route::get('/push-subscriptions/vapid-public-key', [PushSubscriptionController::class, 'vapidPublicKey']);
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store']);
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy']);

    Route::get('/account/sessions', [AccountSessionController::class, 'index']);
    Route::delete('/account/sessions/others', [AccountSessionController::class, 'destroyOthers']);
    Route::delete('/account/sessions/{id}', [AccountSessionController::class, 'destroy']);
});

Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::get('tenants/companies', function (Request $request) {
        $companies = \App\Models\Company::forTenant($request->user()->tenant_id)->get(['id', 'name', 'country', 'currency', 'status']);

        return response()->json($companies);
    });

    Route::get('branding', [BrandingController::class, 'show']);
    Route::put('branding', [BrandingController::class, 'update']);

    Route::apiResource('employees', EmployeeController::class);
    Route::post('employees/bulk', [EmployeeController::class, 'bulkStore']);
    Route::post('employees/{employee}/invite', [EmployeeController::class, 'invite']);
    Route::get('employees/{employee}/leave-balances', [EmployeeController::class, 'leaveBalances']);

    Route::get('payroll/runs', [PayrollRunController::class, 'index']);
    Route::get('payroll/runs/{payrollRun}', [PayrollRunController::class, 'show']);
    Route::post('payroll/runs', [PayrollRunController::class, 'store']);
    Route::post('payroll/runs/{payrollRun}/approve', [PayrollRunController::class, 'approve']);
    Route::post('payroll/runs/{payrollRun}/finalize', [PayrollRunController::class, 'finalize']);
    Route::get('payroll/runs/mine', [PayrollRunController::class, 'myRuns']);
    Route::get('payroll/runs/{payrollRun}/payslip', [PayrollRunController::class, 'downloadPayslip']);
    Route::get('payroll/runs/{payrollRun}/bank-export', [PayrollRunController::class, 'downloadBankExport']);

    Route::get('payroll-calculate/countries', [PayrollCalculatorController::class, 'countries']);
    Route::post('payroll-calculate', [PayrollCalculatorController::class, 'calculate']);

    Route::get('compliance/reports', [ComplianceReportController::class, 'index']);
    Route::post('compliance/reports', [ComplianceReportController::class, 'store']);
    Route::get('compliance/reports/{complianceReport}', [ComplianceReportController::class, 'show']);
    Route::post('payroll/runs/{payrollRun}/compliance', [ComplianceReportController::class, 'generateForPayrollRun']);

    Route::get('compliance/reports/companies/{company}/p10', [ComplianceReportController::class, 'downloadP10']);
    Route::get('compliance/reports/companies/{company}/nssf-remittance', [ComplianceReportController::class, 'downloadNssfRemittance']);
    Route::get('compliance/reports/companies/{company}/nhif-remittance', [ComplianceReportController::class, 'downloadNhifRemittance']);
    Route::get('compliance/reports/companies/{company}/p9', [ComplianceReportController::class, 'downloadP9']);
    Route::get('compliance/reports/companies/{company}/paye-remittance', [ComplianceReportController::class, 'downloadPayeRemittance']);
    Route::get('compliance/reports/companies/{company}/pension-remittance', [ComplianceReportController::class, 'downloadPensionRemittance']);
    Route::get('compliance/reports/companies/{company}/nhf-remittance', [ComplianceReportController::class, 'downloadNhfRemittance']);
    Route::get('compliance/reports/companies/{company}/emp201', [ComplianceReportController::class, 'downloadEmp201']);
    Route::get('compliance/reports/companies/{company}/irp5', [ComplianceReportController::class, 'downloadIrp5']);

    Route::get('billing/plans', [PlanController::class, 'index']);
    Route::get('billing/subscription', [SubscriptionController::class, 'show']);
    Route::get('billing/invoices', [InvoiceController::class, 'index']);
    Route::get('billing/invoices/{invoice}', [InvoiceController::class, 'show']);
    Route::post('billing/invoices/{invoice}/payments', [PaymentController::class, 'store']);
    Route::get('billing/payments/{paymentTransaction}', [PaymentController::class, 'show']);

    Route::apiResource('leave/requests', LeaveRequestController::class);
    Route::post('leave/requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve']);
    Route::post('leave/requests/{leaveRequest}/reject', [LeaveRequestController::class, 'reject']);
    Route::post('leave/requests/{leaveRequest}/cancel', [LeaveRequestController::class, 'cancel']);
    Route::get('leave/requests/mine', [LeaveRequestController::class, 'myRequests']);
    Route::get('leave/types', [LeaveTypeController::class, 'index']);

    // Part 15 — Loans
    Route::apiResource('loans', LoanController::class);
    Route::post('loans/{loan}/approve', [LoanController::class, 'approve']);
    Route::post('loans/{loan}/reject', [LoanController::class, 'reject']);
    Route::get('loans/mine', [LoanController::class, 'myLoans']);
    Route::patch('loans/{loan}/payoff', [LoanController::class, 'payoff']);

    // Part 15 — Attendance
    Route::apiResource('attendance/records', AttendanceController::class);
    Route::post('attendance/records/clock-in', [AttendanceController::class, 'clockIn']);
    Route::post('attendance/records/{attendanceRecord}/clock-out', [AttendanceController::class, 'clockOut']);
    Route::post('attendance/records/mark-holiday', [AttendanceController::class, 'markHoliday']);
    Route::post('attendance/records/mark-absent', [AttendanceController::class, 'markAbsent']);

    // Part 15 — Documents
    Route::apiResource('documents', DocumentController::class);
    Route::post('documents/{employeeDocument}/verify', [DocumentController::class, 'verify']);

    // Part 16 — Employee Onboarding
    Route::apiResource('onboarding/tasks', OnboardingTaskController::class);

    // Part 18 — API Keys & Webhooks
    Route::prefix('settings')->group(function () {
        Route::apiResource('api-keys', ApiKeyController::class);
        Route::post('api-keys/{apiKey}/regenerate', [ApiKeyController::class, 'regenerate'])->name('api-keys.regenerate');
        Route::apiResource('webhook-endpoints', WebhookEndpointController::class);
        Route::get('webhook-endpoints/{webhookEndpoint}/delivery-logs', [WebhookEndpointController::class, 'deliveryLogs'])->name('webhook-endpoints.delivery-logs');
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/{auditLog}', [AuditLogController::class, 'show']);

        // Part 19 — Accounting Integrations
        Route::get('accounting/connections', [AccountingConnectionController::class, 'index']);
        Route::post('accounting/connections', [AccountingConnectionController::class, 'store']);
        Route::get('accounting/connections/{accountingConnection}', [AccountingConnectionController::class, 'show']);
        Route::put('accounting/connections/{accountingConnection}', [AccountingConnectionController::class, 'update']);
        Route::delete('accounting/connections/{accountingConnection}', [AccountingConnectionController::class, 'destroy']);
        Route::get('accounting/connections/{accountingConnection}/sync-jobs', [AccountingConnectionController::class, 'syncJobs']);
        Route::post('accounting/connections/{provider}/oauth/redirect', [AccountingOAuthController::class, 'redirect'])
            ->middleware('web');
    });
});

Route::get('accounting/integrations/callback/{provider}', [AccountingOAuthController::class, 'callback'])
    ->name('accounting.oauth.callback')
    ->middleware(['auth:sanctum', 'web']);
