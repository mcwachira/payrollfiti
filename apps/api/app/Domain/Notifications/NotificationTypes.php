<?php

declare(strict_types=1);

namespace App\Domain\Notifications;

/**
 * Canonical notification event types + their category and channel defaults.
 *
 * Every business event that wants notifications maps to one of these types.
 * The category drives grouping in the UI; the defaults drive per-user channel
 * opt-in until the user overrides via NotificationPreference rows.
 *
 * Channel defaults intentionally lean explicit: email is on for every type,
 * sms/push are off until the user opts in (sms additionally needs a phone
 * number, which the NotificationDispatcher can never invent).
 */
final class NotificationTypes
{
    public const AUTH_LOGIN_NEW_DEVICE = 'auth.login.new_device';

    public const PAYROLL_RUN_COMPLETED = 'payroll.run_completed';

    public const BILLING_PAYMENT_SUCCEEDED = 'billing.payment.succeeded';

    public const BILLING_PAYMENT_FAILED = 'billing.payment.failed';

    public const BILLING_INVOICE_ISSUED = 'billing.invoice.issued';

    public const COMPLIANCE_REPORT_READY = 'compliance.report.ready';

    public const HR_EMPLOYEE_ONBOARDING = 'hr.employee.onboarding';

    public const CATEGORY_AUTH = 'auth';

    public const CATEGORY_PAYROLL = 'payroll';

    public const CATEGORY_BILLING = 'billing';

    public const CATEGORY_COMPLIANCE = 'compliance';

    public const CATEGORY_HR = 'hr';

    public const CHANNELS = ['in_app', 'email', 'sms', 'push'];

    /**
     * @var array<string, array{category: string, title: string, body: string,
     *                            defaults: array<string, bool>}>
     */
    private const TYPES = [
        self::AUTH_LOGIN_NEW_DEVICE => [
            'category' => self::CATEGORY_AUTH,
            'title' => 'New sign-in detected',
            'body' => 'A new device signed in to your PayrollFiti account. If this was not you, review your account security.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
        self::PAYROLL_RUN_COMPLETED => [
            'category' => self::CATEGORY_PAYROLL,
            'title' => 'Payroll completed',
            'body' => 'Your payroll run has been finalized.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
        self::BILLING_PAYMENT_SUCCEEDED => [
            'category' => self::CATEGORY_BILLING,
            'title' => 'Payment received',
            'body' => 'Your payment has been received.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
        self::BILLING_PAYMENT_FAILED => [
            'category' => self::CATEGORY_BILLING,
            'title' => 'Payment failed',
            'body' => 'Your payment could not be completed. Please update your payment method.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
        self::BILLING_INVOICE_ISSUED => [
            'category' => self::CATEGORY_BILLING,
            'title' => 'New invoice',
            'body' => 'A new invoice has been issued for your account.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
        self::COMPLIANCE_REPORT_READY => [
            'category' => self::CATEGORY_COMPLIANCE,
            'title' => 'Compliance report ready',
            'body' => 'A compliance report is ready for download.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
        self::HR_EMPLOYEE_ONBOARDING => [
            'category' => self::CATEGORY_HR,
            'title' => 'New employee onboarded',
            'body' => 'A new employee has been onboarded to your payroll.',
            'defaults' => ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false],
        ],
    ];

    public static function category(string $eventType): string
    {
        return self::TYPES[$eventType]['category'] ?? self::CATEGORY_HR;
    }

    public static function title(string $eventType): ?string
    {
        return self::TYPES[$eventType]['title'] ?? null;
    }

    public static function body(string $eventType): ?string
    {
        return self::TYPES[$eventType]['body'] ?? null;
    }

    public static function isKnown(string $eventType): bool
    {
        return isset(self::TYPES[$eventType]);
    }

    /** @return array<string, bool> */
    public static function defaults(string $eventType): array
    {
        return self::TYPES[$eventType]['defaults']
            ?? ['in_app' => true, 'email' => true, 'sms' => false, 'push' => false];
    }

    /** @return array<string, array{category: string, defaults: array<string, bool>}> */
    public static function all(): array
    {
        return array_map(
            fn (array $type) => ['category' => $type['category'], 'defaults' => $type['defaults']],
            self::TYPES,
        );
    }
}
