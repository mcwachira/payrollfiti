<?php

namespace App\Providers;

use App\Domain\Compliance\Events\ComplianceReportGenerated;
use App\Domain\Leave\Events\LeaveRequestApproved;
use App\Domain\Leave\Events\LeaveRequestCancelled;
use App\Domain\Leave\Events\LeaveRequestRejected;
use App\Domain\Loans\Events\LoanApproved;
use App\Domain\Onboarding\Events\OnboardingTaskCompleted;
use App\Domain\Payments\Events\PaymentFailed;
use App\Domain\Payments\Events\PaymentSettled;
use App\Domain\Payments\Events\PaymentSucceeded;
use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Listeners\DispatchOutboundWebhooks;
use App\Listeners\GeneratePayslips;
use App\Listeners\Leave\HandleLeaveRequestApproved;
use App\Listeners\Leave\HandleLeaveRequestCancelled;
use App\Listeners\Leave\HandleLeaveRequestRejected;
use App\Listeners\Loan\HandleLoanApproved;
use App\Listeners\NotifyComplianceReportReady;
use App\Listeners\NotifyNewLogin;
use App\Listeners\NotifyPaymentFailed;
use App\Listeners\NotifyPaymentSucceeded;
use App\Listeners\Onboarding\HandleOnboardingTaskCompleted;
use App\Listeners\SendPayrollCompletionNotifications;
use App\Listeners\SyncPayrollToAccounting;
use Illuminate\Auth\Events\Login;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

/**
 * Part 13 §13.5 fan-out + Part 14 notification listeners. One domain event,
 * fan-out on dedicated queues so a slow consumer (webhook backpressure) can
 * never stall payslip generation or heartbeat notifications.
 *
 * All listeners are queued (implements ShouldQueue), which is safe because the
 * publishing side writes the outbox row (or dispatches synchronously) in the
 * same DB transaction as the state change; Laravel's redis after-commit
 * guarantee defers dispatch until commit. Event discovery is disabled; every
 * pairing below is explicit so nothing fires by accident.
 */
class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        PayrollRunCompleted::class => [
            GeneratePayslips::class,
            SendPayrollCompletionNotifications::class,
            DispatchOutboundWebhooks::class,
            SyncPayrollToAccounting::class,
        ],

        PaymentSettled::class => [
            DispatchOutboundWebhooks::class,
        ],

        PaymentSucceeded::class => [
            NotifyPaymentSucceeded::class,
        ],

        PaymentFailed::class => [
            NotifyPaymentFailed::class,
        ],

        ComplianceReportGenerated::class => [
            NotifyComplianceReportReady::class,
        ],

        Login::class => [
            NotifyNewLogin::class,
        ],

        LeaveRequestApproved::class => [
            HandleLeaveRequestApproved::class,
        ],

        LeaveRequestRejected::class => [
            HandleLeaveRequestRejected::class,
        ],

        LeaveRequestCancelled::class => [
            HandleLeaveRequestCancelled::class,
        ],

        LoanApproved::class => [
            HandleLoanApproved::class,
        ],

        OnboardingTaskCompleted::class => [
            HandleOnboardingTaskCompleted::class,
        ],
    ];

    public function shouldDiscoverEvents(): bool
    {
        return false;
    }
}
