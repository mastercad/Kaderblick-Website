<?php

namespace App\Controller;

use App\Service\PasswordResetService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api')]
class PasswordResetController extends AbstractController
{
    public function __construct(
        private PasswordResetService $passwordResetService,
        private ValidatorInterface $validator
    ) {
    }

    #[Route('/forgot-password', name: 'forgot_password', methods: ['POST'])]
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['email'])) {
            return $this->json([
                'error' => 'E-Mail-Adresse ist erforderlich'
            ], Response::HTTP_BAD_REQUEST);
        }

        $email = $data['email'];

        // Validiere E-Mail-Format
        $emailConstraint = new Assert\Email();
        $violations = $this->validator->validate($email, $emailConstraint);

        if (count($violations) > 0) {
            return $this->json([
                'error' => 'Ungültige E-Mail-Adresse'
            ], Response::HTTP_BAD_REQUEST);
        }

        $this->passwordResetService->requestPasswordReset($email);

        return $this->json([
            'message' => 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet.'
        ]);
    }

    #[Route('/reset-password', name: 'reset_password', methods: ['POST'])]
    public function resetPassword(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['token']) || !isset($data['password'])) {
            return $this->json([
                'error' => 'Token und Passwort sind erforderlich'
            ], Response::HTTP_BAD_REQUEST);
        }

        $token = $data['token'];
        $password = $data['password'];

        // Validiere Passwort-Länge
        if (strlen($password) < 8) {
            return $this->json([
                'error' => 'Das Passwort muss mindestens 8 Zeichen lang sein'
            ], Response::HTTP_BAD_REQUEST);
        }

        $success = $this->passwordResetService->resetPassword($token, $password);

        if (!$success) {
            return $this->json([
                'error' => 'Ungültiger oder abgelaufener Token'
            ], Response::HTTP_BAD_REQUEST);
        }

        return $this->json([
            'message' => 'Passwort erfolgreich zurückgesetzt'
        ]);
    }

    #[Route('/validate-reset-token/{token}', name: 'validate_reset_token', methods: ['GET'])]
    public function validateToken(string $token): JsonResponse
    {
        $resetToken = $this->passwordResetService->validateToken($token);

        if (!$resetToken) {
            return $this->json([
                'valid' => false,
                'error' => 'Ungültiger oder abgelaufener Token'
            ], Response::HTTP_BAD_REQUEST);
        }

        return $this->json([
            'valid' => true
        ]);
    }
}
