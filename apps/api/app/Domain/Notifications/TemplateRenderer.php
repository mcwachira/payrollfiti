<?php

declare(strict_types=1);

namespace App\Domain\Notifications;

use App\Models\NotificationTemplate;

/**
 * Renders notification subject + body from an event data payload.
 *
 * Security model: templates may only interpolate the placeholders declared in
 * the template's `variables` column. `{{ name }}` placeholders that are NOT
 * declared (and therefore not in the payload) are removed; nothing else is
 * ever substituted. No Blade-evaluate, no raw strings — event data can never
 * inject markup or template syntax.
 *
 * When no template exists for a (tenant, event_type, channel) combination a
 * generic fallback title/body from NotificationTypes is used so new event
 * types still produce a readable bell entry without admin action.
 */
final class TemplateRenderer
{
    /** @return array{template: NotificationTemplate|null, subject: string|null, body: string} */
    public function render(string $tenantId, string $eventType, string $channel, array $data): array
    {
        $template = NotificationTemplate::forTenantAndChannel($tenantId, $eventType, $channel);

        if ($template === null) {
            return [
                'template' => null,
                'subject' => NotificationTypes::title($eventType),
                'body' => $this->applyFallback($eventType, $data),
            ];
        }

        $allowed = $template->variables ?? [];

        return [
            'template' => $template,
            'subject' => $this->interpolate($template->subject, $allowed, $data),
            'body' => $this->interpolate($template->body, $allowed, $data),
        ];
    }

    private function applyFallback(string $eventType, array $data): string
    {
        $body = NotificationTypes::body($eventType);

        if ($body === null) {
            return 'A new update is available for your account.';
        }

        if (isset($data['company']) && is_string($data['company'])) {
            return str_replace('{company}', $data['company'], $body);
        }

        return $body;
    }

    private function interpolate(?string $text, array $allowed, array $data): string
    {
        if ($text === null || $text === '') {
            return '';
        }

        $allowed = array_map('strval', (array) $allowed);

        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/', function (array $m) use ($allowed, $data): string {
            $key = $m[1];

            if (in_array($key, $allowed, true) && array_key_exists($key, $data)) {
                $value = $data[$key];

                return is_scalar($value) ? (string) $value : (string) json_encode($value, JSON_UNESCAPED_SLASHES);
            }

            return '';
        }, $text) ?? '';
    }
}
