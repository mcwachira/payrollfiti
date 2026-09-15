<?php

declare(strict_types=1);

namespace App\Infrastructure\Accounting;

use Illuminate\Http\Request;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User;

class GenericOAuth2Provider extends AbstractProvider
{
    private array $providerConfig;

    public function __construct(
        Request $request,
        $clientId,
        $clientSecret,
        $redirectUrl,
        array $guzzle = [],
        array $config = [],
    ) {
        parent::__construct($request, $clientId, $clientSecret, $redirectUrl, $guzzle);

        $this->providerConfig = $config;
    }

    protected function getAuthUrl($state): string
    {
        return $this->buildAuthUrlFromBase($this->providerConfig['authorize_url'], $state);
    }

    protected function getTokenUrl(): string
    {
        return $this->providerConfig['token_url'];
    }

    protected function getUserByToken($token): array
    {
        $response = $this->getHttpClient()->get($this->providerConfig['user_url'], [
            'headers' => ['Authorization' => 'Bearer '.$token],
        ]);

        return json_decode($response->getBody()->getContents(), true) ?: [];
    }

    protected function mapUserToObject(array $user): User
    {
        $userIdField = $this->providerConfig['user_id_field'] ?? 'id';

        return (new User)->setRaw($user)->map([
            'id' => (string) data_get($user, $userIdField, ''),
        ]);
    }
}
