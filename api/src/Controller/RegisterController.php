<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\UserVerificationService;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api', name: 'api_')]
class RegisterController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserVerificationService $verificationService,
    ) {
    }

    #[Route('/register', name: 'register', methods: ['POST'])]
    public function register(
        Request $request,
        UserPasswordHasherInterface $passwordHasher
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);

        // Validate required fields
        if (empty($data['email']) || empty($data['password']) || empty($data['fullName'])) {
            return new JsonResponse(
                ['error' => 'E-Mail, Passwort und vollständiger Name sind erforderlich.'],
                400,
            );
        }

        // Split fullname into firstName and lastName
        $fullName = trim($data['fullName'] ?? '');
        $nameParts = explode(' ', $fullName);

        // Last word is lastName, everything before is firstName
        $lastName = array_pop($nameParts);
        $firstName = implode(' ', $nameParts);

        $user = new User();
        $user->setEmail($data['email'])
            ->setPassword($passwordHasher->hashPassword($user, $data['password']))
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setRoles(['ROLE_GUEST']);

        $this->verificationService->createVerificationToken($user);

        try {
            $this->em->persist($user);
            $this->em->flush();
        } catch (UniqueConstraintViolationException $exception) {
            return new JsonResponse(
                ['error' => 'E-Mail-Adresse bereits registriert.'],
                400,
            );
        }

        $this->verificationService->sendVerificationEmail($user);

        return new JsonResponse(['message' => 'Registrierung erfolgreich. Bitte E-Mail bestätigen.'], 201);
    }
}
