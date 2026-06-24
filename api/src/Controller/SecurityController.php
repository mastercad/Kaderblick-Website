<?php

namespace App\Controller;

use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class SecurityController extends AbstractController
{
    #[Route('/connect/google', name: 'connect_google_start')]
    public function connectGoogle(ClientRegistry $clientRegistry): RedirectResponse
    {
        return $clientRegistry->getClient('google')->redirect(
            ['profile', 'email'],
            []
        );
    }

    #[Route('/connect/google/check', name: 'connect_google_check')]
    public function connectGoogleCheck(): void
    {
        throw $this->createNotFoundException('This route should be handled by GoogleAuthenticator');
    }

    #[Route('/google-drive/oauth/callback', name: 'google_drive_oauth_callback')]
    public function googleDriveOauthCallback(Request $request): Response
    {
        $code = $request->query->get('code');
        $error = $request->query->get('error');

        if ($error) {
            return new Response('Google OAuth Fehler: ' . htmlspecialchars($error), 400);
        }

        if (!$code) {
            return new Response('Kein code erhalten.', 400);
        }

        return new Response(
            '<h1>Google OAuth Code</h1>' .
            '<p>Kopiere diesen Code in dein Symfony Command:</p>' .
            '<textarea style="width:100%;height:140px;">' .
            htmlspecialchars($code) .
            '</textarea>'
        );
    }
}
