<?php

namespace App\Security;

use Lexik\Bundle\JWTAuthenticationBundle\TokenExtractor\AuthorizationHeaderTokenExtractor;
use Lexik\Bundle\JWTAuthenticationBundle\TokenExtractor\TokenExtractorInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Replaces Lexik's authorization header extractor to skip personal API tokens
 * (kbak_ prefix). Returns false for kbak_ tokens so Lexik JWT's supports()
 * returns false and ApiTokenAuthenticator handles them instead.
 *
 * Excluded from App\ auto-discovery (services.yaml) to avoid double registration.
 * The Lexik bundle injects $prefix and $headerName via replaceArgument().
 */
class JwtTokenExtractor implements TokenExtractorInterface
{
    private AuthorizationHeaderTokenExtractor $inner;

    public function __construct(string $prefix = 'Bearer', string $headerName = 'Authorization')
    {
        $this->inner = new AuthorizationHeaderTokenExtractor($prefix, $headerName);
    }

    public function extract(Request $request): string | false
    {
        $token = $this->inner->extract($request);

        if (false !== $token && str_starts_with($token, ApiTokenAuthenticator::TOKEN_PREFIX)) {
            return false;
        }

        return $token;
    }
}
