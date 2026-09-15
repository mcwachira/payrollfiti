<?php

namespace App\Infrastructure\Payments;

use RuntimeException;

final readonly class CurlClient
{
    /**
     * @param  array<string, string>  $headers
     */
    public function json(string $method, string $url, array $headers, ?array $payload = null, int $timeout = 30): array
    {
        $handle = curl_init();

        try {
            curl_setopt_array($handle, [
                CURLOPT_URL => $url,
                CURLOPT_CUSTOMREQUEST => strtoupper($method),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER => false,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_HTTPHEADER => array_map(fn (string $key, string $value) => "{$key}: {$value}", array_keys($headers), array_values($headers)),
            ]);

            if ($payload !== null) {
                curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($payload));
            }

            $body = curl_exec($handle);

            if (curl_errno($handle) !== 0) {
                throw new RuntimeException('Http request failed: '.curl_error($handle));
            }

            $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);

            $decoded = json_decode((string) $body, true);

            return [
                'status' => (int) $status,
                'body' => is_array($decoded) ? $decoded : ['raw' => $body],
            ];
        } finally {
            curl_close($handle);
        }
    }
}
