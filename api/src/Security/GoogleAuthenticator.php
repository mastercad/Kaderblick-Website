<?php

namespace App\Security;

use App\Entity\User;
use App\Service\RefreshTokenService;
use App\Service\RegistrationNotificationService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use KnpU\OAuth2ClientBundle\Client\OAuth2Client;
use KnpU\OAuth2ClientBundle\Exception\InvalidStateException;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Throwable;
use Twig\Environment;

class GoogleAuthenticator extends AbstractAuthenticator
{
    public function __construct(
        private ClientRegistry $clientRegistry,
        private EntityManagerInterface $em,
        private JWTTokenManagerInterface $jwtManager,
        private RefreshTokenService $refreshTokenService,
        private Environment $twig,
        private MailerInterface $mailer,
        private ParameterBagInterface $params,
        private RegistrationNotificationService $registrationNotificationService,
        private LoggerInterface $logger,
        private int $jwtTtl = 3600
    ) {
    }

    public function supports(Request $request): ?bool
    {
        return 'connect_google_check' === $request->attributes->get('_route');
    }

    public function authenticate(Request $request): Passport
    {
        $client = $this->clientRegistry->getClient('google');

        try {
            $accessToken = $client->getAccessToken();
        } catch (InvalidStateException $e) {
            // Diagnose: Session-State vs. URL-State loggen
            $session = $request->hasSession() ? $request->getSession() : null;
            $sessionState = $session?->get(OAuth2Client::OAUTH2_SESSION_STATE_KEY, '(nicht gesetzt)');
            $urlState = $request->query->get('state', '(fehlt)');

            $this->logger->warning('Google OAuth: Invalid state – Session und URL-State stimmen nicht überein.', [
                'session_state' => $sessionState,
                'url_state' => $urlState,
                'session_id' => $session?->getId() ?? 'keine Session',
                'user_agent' => $request->headers->get('User-Agent'),
                'ip' => $request->getClientIp(),
            ]);

            // Als AuthenticationException weiterwerfen, damit onAuthenticationFailure() greift
            throw new CustomUserMessageAuthenticationException('invalid_state');
        }
        $googleUser = $client->fetchUserFromToken($accessToken);
        $googleUserData = $googleUser->toArray();
        $googleId = $googleUser->getId();
        $email = $googleUserData['email'];
        $mailer = $this->mailer;
        $params = $this->params;

        return new SelfValidatingPassport(
            new UserBadge($googleId, function () use ($googleId, $email, $googleUserData, $mailer, $params, $request) {
                $user = $this->em->getRepository(User::class)->findOneBy(['googleId' => $googleId]);
                if (!$user) {
                    $isCompletelyNew = false;
                    $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
                    if ($user) {
                        $user->setGoogleId($googleId);
                    } else {
                        $isCompletelyNew = true;
                        $user = new User();
                        $user->setEmail($email);
                        $user->setGoogleId($googleId);
                        $user->setFirstName($googleUserData['given_name']);
                        $user->setLastName($googleUserData['family_name']);
                        $user->setPassword('!');
                        $user->setRoles(['ROLE_USER']);
                        $user->setIsVerified(true);
                        $user->setIsEnabled(true);
                    }

                    $this->em->persist($user);
                    $this->em->flush();

                    if ($isCompletelyNew) {
                        $request->attributes->set('_is_new_google_user', true);
                        try {
                            $this->registrationNotificationService->notifyAdminsAboutNewUser($user);
                        } catch (Throwable) {
                            // Non-critical – don't fail the login
                        }
                    }

                    $email = (new TemplatedEmail())
                        ->from('no-reply@kaderblick.de')
                        ->to($user->getEmail())
                        ->subject('Willkommen auf der Plattform')
                        ->htmlTemplate('emails/welcome.html.twig')
                        ->context([
                            'name' => $user->getEmail(),
                            'website_url' => $params->get('app.website_url'),
                            'contact_email' => $params->get('app.contact_email'),
                            'phone_number' => $params->get('app.phone_number')
                        ]);

                    $mailer->send($email);
                }

                // A user who signs in via Google SSO has proven ownership of this email address.
                // If the account was created via email/password but never verified, verify it now.
                $needsFlush = false;

                if (!$user->isVerified()) {
                    $user->setIsVerified(true);
                    $user->setVerificationToken(null);
                    $user->setVerificationExpires(null);
                    $user->setEmailVerificationToken(null);
                    $user->setEmailVerificationTokenExpiresAt(null);
                    $needsFlush = true;
                }

                // Always keep the stored Google avatar URL up to date (runs for every login)
                if (!empty($googleUserData['picture'])) {
                    $user->setGoogleAvatarUrl($googleUserData['picture']);
                    $needsFlush = true;
                }

                if ($needsFlush) {
                    $this->em->flush();
                }

                return $user;
            })
        );
    }

    public function onAuthenticationSuccess(
        Request $request,
        TokenInterface $token,
        string $firewallName
    ): ?Response {
        /** @var User $user */
        $user = $token->getUser();
        $accessToken = $this->jwtManager->create($user);
        $refreshToken = $this->refreshTokenService->createRefreshToken($user);

        $expireDate = (new DateTime())->modify("+{$this->jwtTtl} seconds");
        $expireTimestamp = $expireDate->getTimestamp();

        // Auth-Daten für das Template vorbereiten
        $isNewUser = $request->attributes->get('_is_new_google_user', false);
        $authData = [
            'success' => true,
            'token' => $accessToken,
            'refreshToken' => $refreshToken,
            'isNewUser' => $isNewUser,
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
                'name' => $user->getFullName(),
                'firstName' => $user->getFirstName(),
                'lastName' => $user->getLastName(),
            ]
        ];

        $response = new Response(
            $this->twig->render('security/google_success.html.twig', [
                'authData' => json_encode($authData),
                'frontend_url' => rtrim($this->params->get('app.website_url'), '/'),
            ])
        );

        $response->headers->setCookie(
            new Cookie(
                'jwt_token',
                $accessToken,
                $expireTimestamp,
                '/',
                null,
                true,
                true,
                false,
                'strict'
            ),
        );

        $response->headers->setCookie(
            new Cookie(
                'jwt_refresh_token',
                $refreshToken,
                new DateTime('+7 days'),
                '/',
                null,
                true,
                true,
                false,
                'strict'
            ),
        );

        return $response;
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?RedirectResponse
    {
        // Bei Invalid-State: unterscheiden ob echter Nutzer (Session-State vorhanden, aber abgelaufen)
        // oder Bot (kein Session-State – direkte Probe der Callback-URL).
        if ('invalid_state' === $exception->getMessageKey()) {
            $session = $request->hasSession() ? $request->getSession() : null;
            $sessionState = $session?->get(OAuth2Client::OAUTH2_SESSION_STATE_KEY);

            if (null !== $sessionState) {
                // Echter Nutzer: Session-State war gesetzt, aber stimmt nicht mehr überein
                // (z. B. abgelaufene Session, mehrere Tabs). Neuen Auth-Flow starten.
                $this->logger->info('Google OAuth: Automatischer Retry nach Invalid-State (Session-State vorhanden).');

                return new RedirectResponse('/connect/google');
            }

            // Bot oder direkter Aufruf ohne vorherigen OAuth-Flow: kein neuen Flow starten.
            $this->logger->debug('Google OAuth: Invalid-State ohne Session-State – wahrscheinlich Bot, kein Retry.');

            return new RedirectResponse('/login');
        }

        return new RedirectResponse('/login?error=google');
    }

    /**
     * @return array<string, string>
     */
    public function splitNameToFirstAndLast(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name));
        if (!$parts) {
            return ['first' => '', 'last' => ''];
        }
        $last = array_pop($parts);
        $first = implode(' ', $parts);

        return [
            'first' => $first,
            'last' => $last
        ];
    }
}
