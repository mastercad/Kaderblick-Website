<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\DefaultDashboardService;
use App\Service\RegistrationNotificationService;
use App\Service\UserVerificationService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Routing\Attribute\Route;
use Throwable;

#[Route('/api', name: 'api_')]
class VerificationController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private ParameterBagInterface $params,
        private DefaultDashboardService $defaultDashboardService,
        private RegistrationNotificationService $registrationNotificationService,
        private UserVerificationService $verificationService,
    ) {
    }

    #[Route('/verify-email/{token}', name: 'verify_email', methods: ['GET'])]
    public function verifyEmail(string $token, MailerInterface $mailer): JsonResponse
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['verificationToken' => $token]);

        if (!$user) {
            return new JsonResponse(
                ['error' => 'Der Verifizierungslink ist ungültig oder abgelaufen.'],
                404
            );
        }

        // Check if token is expired
        if ($user->getVerificationExpires() && $user->getVerificationExpires() < new DateTime()) {
            return new JsonResponse(
                ['error' => 'Der Verifizierungslink ist abgelaufen.'],
                410
            );
        }

        $user->setIsVerified(true)
             ->setIsEnabled(true)
             ->setVerificationToken(null)
             ->setVerificationExpires(null);

        $user->setBaseRole('ROLE_USER');

        $this->em->flush();

        // Create default dashboard for the verified user
        try {
            $this->defaultDashboardService->createDefaultDashboard($user);
        } catch (Throwable) {
            // Non-critical – don't fail the verification
        }

        // Notify admins about the newly verified user
        try {
            $this->registrationNotificationService->notifyAdminsAboutNewUser($user);
        } catch (Throwable) {
            // Non-critical – don't fail the verification
        }

        // Send welcome email
        try {
            $welcomeEmail = (new TemplatedEmail())
                ->from('no-reply@kaderblick.de')
                ->to($user->getEmail())
                ->subject('Willkommen auf der Plattform')
                ->htmlTemplate('emails/welcome.html.twig')
                ->context([
                    'name' => $user->getEmail(),
                    'website_url' => $this->params->get('app.website_url'),
                    'contact_email' => $this->params->get('app.contact_email'),
                    'phone_number' => $this->params->get('app.phone_number'),
                ]);
            $mailer->send($welcomeEmail);
        } catch (Throwable) {
            // Non-critical – don't fail the verification
        }

        return new JsonResponse([
            'message' => 'Deine E-Mail-Adresse wurde erfolgreich verifiziert. Du kannst dich jetzt anmelden.',
            'needsContext' => true,
        ], 200);
    }

    #[Route('/resend-verification/{userId}', name: 'resend_verification', methods: ['POST'])]
    public function resendVerification(int $userId): JsonResponse
    {
        $user = $this->em->getRepository(User::class)->find($userId);

        if (!$user) {
            return new JsonResponse(
                ['error' => 'Benutzer nicht gefunden.'],
                404
            );
        }

        $this->verificationService->createVerificationToken($user);
        $this->em->flush();

        $this->verificationService->sendVerificationEmail($user);

        return new JsonResponse([
            'success' => true,
            'message' => 'Verifizierungslink wurde erfolgreich erneut gesendet.'
        ], 200);
    }

    #[Route('/verify/email', name: 'verify_email_legacy', methods: ['GET'])]
    public function verifyUserEmail(
        Request $request,
        UserRepository $userRepository,
        MailerInterface $mailer
    ): JsonResponse {
        $token = $request->query->get('Token');

        if (!$token) {
            return new JsonResponse(
                ['error' => 'Token fehlt.'],
                400
            );
        }

        $user = $userRepository->findUserByValidationToken($token);

        if (!$user instanceof User) {
            return new JsonResponse(
                ['error' => 'Ungültiger Token.'],
                404
            );
        }

        $user->setIsVerified(true)
             ->setIsEnabled(true);

        $user->setBaseRole('ROLE_USER');

        $this->em->persist($user);
        $this->em->flush();

        $email = (new TemplatedEmail())
            ->from('no-reply@kaderblick.de')
            ->to($user->getEmail())
            ->subject('Willkommen auf der Plattform')
            ->htmlTemplate('emails/welcome.html.twig')
            ->context([
                'name' => $user->getEmail(),
                'website_url' => $this->params->get('app.website_url'),
                'contact_email' => $this->params->get('app.contact_email'),
                'phone_number' => $this->params->get('app.phone_number')
            ]);

        $mailer->send($email);

        return new JsonResponse([
            'message' => 'Dein Account wurde erfolgreich aktiviert! Du kannst dich jetzt anmelden.'
        ], 200);
    }

    #[Route('/verify/success', name: 'app_verify_success')]
    public function verifySuccess(): JsonResponse
    {
        return $this->json(['message' => 'E-Mail erfolgreich bestätigt']);
    }
}
