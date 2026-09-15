<?php

namespace App\Providers;

use App\Models\AccountingConnection;
use App\Models\ApiKey;
use App\Models\AttendanceRecord;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\ComplianceReport;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\Invoice;
use App\Models\LeaveRequest;
use App\Models\Loan;
use App\Models\Notification;
use App\Models\OnboardingTask;
use App\Models\PaymentTransaction;
use App\Models\PayrollRun;
use App\Models\User;
use App\Models\WebhookEndpoint;
use App\Policies\AccountingConnectionPolicy;
use App\Policies\ApiKeyPolicy;
use App\Policies\AttendancePolicy;
use App\Policies\AuditLogPolicy;
use App\Policies\ComplianceReportPolicy;
use App\Policies\EmployeeDocumentPolicy;
use App\Policies\EmployeePolicy;
use App\Policies\InvoicePolicy;
use App\Policies\LeaveRequestPolicy;
use App\Policies\LoanPolicy;
use App\Policies\NotificationPolicy;
use App\Policies\OnboardingTaskPolicy;
use App\Policies\PaymentTransactionPolicy;
use App\Policies\PayrollRunPolicy;
use App\Policies\WebhookEndpointPolicy;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Laravel\Horizon\Horizon;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TenantContext::class, fn () => new TenantContext);
        $this->app->alias(TenantContext::class, 'tenant.context');
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Model::preventLazyLoading(env('APP_ENV', 'production') !== 'production');

        Gate::policy(Employee::class, EmployeePolicy::class);
        Gate::policy(PayrollRun::class, PayrollRunPolicy::class);
        Gate::policy(ComplianceReport::class, ComplianceReportPolicy::class);
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(PaymentTransaction::class, PaymentTransactionPolicy::class);
        Gate::policy(Notification::class, NotificationPolicy::class);
        Gate::policy(LeaveRequest::class, LeaveRequestPolicy::class);
        Gate::policy(Loan::class, LoanPolicy::class);
        Gate::policy(AttendanceRecord::class, AttendancePolicy::class);
        Gate::policy(EmployeeDocument::class, EmployeeDocumentPolicy::class);
        Gate::policy(OnboardingTask::class, OnboardingTaskPolicy::class);
        Gate::policy(ApiKey::class, ApiKeyPolicy::class);
        Gate::policy(WebhookEndpoint::class, WebhookEndpointPolicy::class);
        Gate::policy(AuditLog::class, AuditLogPolicy::class);
        Gate::policy(AccountingConnection::class, AccountingConnectionPolicy::class);

        Route::bind('employee', fn ($value) => Employee::withoutTenantScope()->whereKey($value)->firstOrFail());
        Route::bind('payrollRun', fn ($value) => PayrollRun::withoutTenantScope()->whereKey($value)->firstOrFail());
        Route::bind('complianceReport', fn ($value) => ComplianceReport::withoutTenantScope()->whereKey($value)->firstOrFail());
        Route::bind('leaveRequest', fn ($value) => LeaveRequest::withoutTenantScope()->whereKey($value)->firstOrFail());
        Route::bind('loan', fn ($value) => Loan::withoutTenantScope()->whereKey($value)->firstOrFail());
        Route::bind('attendanceRecord', fn ($value) => AttendanceRecord::withoutTenantScope()->whereKey($value)->firstOrFail());
        Route::bind('employeeDocument', function ($value) {
            return EmployeeDocument::withoutTenantScope()
                ->whereKey($value)
                ->firstOrFail();
        });

        Route::bind('onboardingTask', function ($value) {
            $user = request()->user();

            if (! $user instanceof User) {
                return null;
            }

            return OnboardingTask::withoutTenantScope()
                ->where('tenant_id', $user->tenant_id)
                ->whereKey($value)
                ->first();
        });

        Route::bind('apiKey', function ($value) {
            $user = request()->user();

            if (! $user instanceof User) {
                return null;
            }

            return ApiKey::withoutTenantScope()
                ->where('tenant_id', $user->tenant_id)
                ->whereKey($value)
                ->first();
        });

        Route::bind('webhookEndpoint', function ($value) {
            $user = request()->user();

            if (! $user instanceof User) {
                return null;
            }

            return WebhookEndpoint::withoutTenantScope()
                ->where('tenant_id', $user->tenant_id)
                ->whereKey($value)
                ->first();
        });

        Route::bind('auditLog', function ($value) {
            $user = request()->user();

            if (! $user instanceof User) {
                return null;
            }

            return AuditLog::withoutTenantScope()
                ->where('tenant_id', $user->tenant_id)
                ->whereKey($value)
                ->first();
        });

        Route::bind('accountingConnection', function ($value) {
            $user = request()->user();

            if (! $user instanceof User) {
                return null;
            }

            return AccountingConnection::withoutTenantScope()
                ->where('tenant_id', $user->tenant_id)
                ->whereKey($value)
                ->first();
        });

        // Part 14: notifications are private per-user. Binding a notification
        // that belongs to a different user (of any tenant) resolves to null →
        // implicit binding throws ModelNotFound → clean 404 with no 403 leak.
        Route::bind('notification', function ($value) {
            $user = request()->user();

            if (! $user instanceof User) {
                return null;
            }

            return Notification::withoutTenantScope()
                ->where('user_id', $user->id)
                ->whereKey($value)
                ->first();
        });

        Gate::before(function ($user, $ability, $arguments = []) {
            if ($user && method_exists($user, 'hasRole') && $user->hasRole('platform_admin')) {
                return true;
            }

            $resource = $arguments[0] ?? null;

            if ($ability === 'run' && $resource instanceof Company) {
                return $user?->tenant_id === $resource->tenant_id && $user?->can('payroll.manage');
            }

            return null;
        });

        $this->configureHorizonAccess();
    }

    /**
     * Horizon is platform operator tooling — only platform admins and tenant
     * admins may open the dashboard. Tenant isolation on workers is enforced by
     * TenantAwareJob itself (boot() clears before every attempt and the final
     * handle() guarantees set→try/finally→clear), so a worker touched by
     * tenant A never starts tenant B's work with A leaked into
     * `app.current_tenant_id`.
     */
    private function configureHorizonAccess(): void
    {
        Gate::define('viewHorizon', function ($user) {
            if ($user === null || ! method_exists($user, 'hasRole')) {
                return false;
            }

            return $user->hasRole('platform_admin') || $user->hasRole('admin');
        });

        Horizon::auth(fn ($request) => Gate::check('viewHorizon', [$request->user()]));
    }
}
