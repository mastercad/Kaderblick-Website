<?php

declare(strict_types=1);

namespace App\Service;

use RuntimeException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class StripeBillingClient
{
    private const API = 'https://api.stripe.com/v1';

    public function __construct(private HttpClientInterface $httpClient)
    {
    }

    public function isConfigured(): bool
    {
        return '' !== $this->secretKey() && '' !== $this->webhookSecret();
    }

    /**
     * @param array<string, scalar|array<mixed>|null> $parameters
     * @return array<string, mixed>
     */
    public function post(string $path, array $parameters): array
    {
        if ('' === $this->secretKey()) {
            throw new RuntimeException('Stripe ist noch nicht konfiguriert.');
        }

        $response = $this->httpClient->request('POST', self::API . $path, [
            'auth_bearer' => $this->secretKey(),
            'body' => http_build_query($parameters, '', '&', PHP_QUERY_RFC3986),
            'headers' => ['Stripe-Version' => '2025-06-30.basil', 'Content-Type' => 'application/x-www-form-urlencoded'],
        ]);
        $data = $response->toArray(false);
        if ($response->getStatusCode() >= 400) {
            throw new RuntimeException((string) ($data['error']['message'] ?? 'Stripe-Anfrage fehlgeschlagen.'));
        }

        return $data;
    }

    /** @return array<string, mixed> */
    public function verifyWebhook(string $payload, string $signatureHeader): array
    {
        $parts = [];
        foreach (explode(',', $signatureHeader) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            $parts[$key][] = $value;
        }
        $timestamp = (int) ($parts['t'][0] ?? 0);
        if ('' === $this->webhookSecret() || abs(time() - $timestamp) > 300) {
            throw new RuntimeException('Ungültige oder abgelaufene Stripe-Signatur.');
        }
        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $this->webhookSecret());
        $valid = false;
        foreach ($parts['v1'] ?? [] as $signature) {
            $valid = $valid || hash_equals($expected, $signature);
        }
        if (!$valid) {
            throw new RuntimeException('Stripe-Signatur konnte nicht verifiziert werden.');
        }
        $event = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);

        return is_array($event) ? $event : throw new RuntimeException('Ungültiger Stripe-Payload.');
    }

    private function secretKey(): string
    {
        return (string) ($_ENV['STRIPE_SECRET_KEY'] ?? '');
    }
    private function webhookSecret(): string
    {
        return (string) ($_ENV['STRIPE_WEBHOOK_SECRET'] ?? '');
    }
}
