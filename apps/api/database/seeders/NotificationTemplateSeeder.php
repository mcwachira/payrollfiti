<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Notifications\NotificationTypes;
use App\Models\NotificationTemplate;
use Illuminate\Database\Seeder;

/**
 * Platform-wide (tenant_id NULL) notification templates for the known event
 * types. These are the out-of-the-box copy; tenants can override any of them
 * by inserting their own row with the same (code, channel).
 *
 * The `variables` column is the allow-list of placeholders that TemplateRenderer
 * may interpolate — anything not declared there is stripped at render time.
 */
class NotificationTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            NotificationTypes::AUTH_LOGIN_NEW_DEVICE => [
                'in_app' => [
                    'subject' => 'New sign-in detected',
                    'body' => 'A new device signed in to your PayrollFiti account. If this was not you, review your account security.',
                ],
                'email' => [
                    'subject' => 'New sign-in detected on your PayrollFiti account',
                    'body' => 'We noticed a new sign-in to your PayrollFiti account. If this was not you, please review your account security immediately.',
                ],
                'sms' => null,
            ],
            NotificationTypes::PAYROLL_RUN_COMPLETED => [
                'in_app' => [
                    'subject' => 'Payroll completed',
                    'body' => 'Payroll run for {{ company }} has been finalized.',
                    'variables' => ['company'],
                ],
                'email' => [
                    'subject' => 'Payroll run completed',
                    'body' => 'Your payroll run for {{ company }} has been finalized successfully.',
                    'variables' => ['company'],
                ],
                'sms' => [
                    'subject' => null,
                    'body' => 'Payroll finalized for {{ company }}.',
                    'variables' => ['company'],
                ],
            ],
            NotificationTypes::BILLING_PAYMENT_SUCCEEDED => [
                'in_app' => [
                    'subject' => 'Payment received',
                    'body' => 'Your payment of {{ amount }} {{ currency }} has been received.',
                    'variables' => ['amount', 'currency'],
                ],
                'email' => [
                    'subject' => 'Payment received',
                    'body' => 'Your payment of {{ amount }} {{ currency }} was received. Thank you.',
                    'variables' => ['amount', 'currency'],
                ],
                'sms' => null,
            ],
            NotificationTypes::BILLING_PAYMENT_FAILED => [
                'in_app' => [
                    'subject' => 'Payment failed',
                    'body' => 'Your payment of {{ amount }} {{ currency }} could not be completed. Please update your payment method.',
                    'variables' => ['amount', 'currency'],
                ],
                'email' => [
                    'subject' => 'Action needed: payment failed',
                    'body' => 'Your payment of {{ amount }} {{ currency }} failed. Update your payment method to keep your account current.',
                    'variables' => ['amount', 'currency'],
                ],
                'sms' => [
                    'subject' => null,
                    'body' => 'Your payment of {{ amount }} {{ currency }} failed. Update your payment method.',
                    'variables' => ['amount', 'currency'],
                ],
            ],
            NotificationTypes::BILLING_INVOICE_ISSUED => [
                'in_app' => [
                    'subject' => 'New invoice issued',
                    'body' => 'Invoice for {{ total }} {{ currency }} has been issued.',
                    'variables' => ['total', 'currency'],
                ],
                'email' => [
                    'subject' => 'New invoice',
                    'body' => 'A new invoice for {{ total }} {{ currency }} has been issued for your account.',
                    'variables' => ['total', 'currency'],
                ],
                'sms' => null,
            ],
            NotificationTypes::COMPLIANCE_REPORT_READY => [
                'in_app' => [
                    'subject' => 'Compliance report ready',
                    'body' => 'Your {{ country }} compliance report ({{ report_code }}) is ready.',
                    'variables' => ['country', 'report_code'],
                ],
                'email' => [
                    'subject' => 'Compliance report ready',
                    'body' => 'Your {{ country }} compliance report ({{ report_code }}) is ready to download.',
                    'variables' => ['country', 'report_code'],
                ],
                'sms' => null,
            ],
            NotificationTypes::HR_EMPLOYEE_ONBOARDING => [
                'in_app' => [
                    'subject' => 'New employee onboarded',
                    'body' => '{{ employee_name }} has been onboarded to your payroll.',
                    'variables' => ['employee_name'],
                ],
                'email' => [
                    'subject' => 'New employee onboarded',
                    'body' => '{{ employee_name }} has been onboarded to your payroll.',
                    'variables' => ['employee_name'],
                ],
                'sms' => null,
            ],
        ];

        foreach ($templates as $eventType => $channels) {
            foreach ($channels as $channel => $payload) {
                if ($payload === null) {
                    continue;
                }

                NotificationTemplate::query()
                    ->whereNull('tenant_id')
                    ->where('code', $eventType)
                    ->where('channel', $channel)
                    ->delete();

                NotificationTemplate::create([
                    'tenant_id' => null,
                    'code' => $eventType,
                    'channel' => $channel,
                    'subject' => $payload['subject'],
                    'body' => $payload['body'],
                    'variables' => $payload['variables'] ?? null,
                    'active' => true,
                ]);
            }
        }
    }
}
