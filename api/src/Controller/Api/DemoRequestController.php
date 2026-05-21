<?php

namespace App\Controller\Api;

use App\Entity\DemoRequest;
use App\Repository\DemoRequestRepository;
use App\Service\DemoRequestNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class DemoRequestController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DemoRequestRepository $demoRequestRepository,
        private readonly DemoRequestNotificationService $notificationService,
        private readonly ValidatorInterface $validator,
    ) {
    }

    #[Route('/api/demo-request', name: 'api_demo_request_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        // Trim all string fields before validation so whitespace-only values are rejected
        // and leading/trailing whitespace in emails doesn't cause false validation failures.
        if (\is_array($data)) {
            foreach ($data as $key => $value) {
                if (\is_string($value)) {
                    $data[$key] = trim($value);
                }
            }
        }

        $constraints = new Assert\Collection([
            'name' => [new Assert\NotBlank(message: 'Bitte gib deinen Namen an.'), new Assert\Length(max: 255)],
            'email' => [new Assert\NotBlank(message: 'Bitte gib deine E-Mail-Adresse an.'), new Assert\Email(message: 'Bitte gib eine gültige E-Mail-Adresse an.')],
            'clubName' => new Assert\Optional([new Assert\Length(max: 255)]),
            'league' => new Assert\Optional([new Assert\Length(max: 255)]),
            'ageGroup' => new Assert\Optional([new Assert\Length(max: 255)]),
            'phone' => new Assert\Optional([new Assert\Length(max: 50)]),
            'message' => new Assert\Optional([new Assert\Length(max: 2000)]),
        ]);

        $violations = $this->validator->validate($data ?? [], $constraints);
        if (count($violations) > 0) {
            $errors = [];
            foreach ($violations as $violation) {
                $errors[] = $violation->getMessage();
            }

            return $this->json(['error' => implode(' ', $errors)], 400);
        }

        $email = trim((string) ($data['email'] ?? ''));

        $existingRequest = $this->demoRequestRepository->findOneByEmailPending($email);
        if (null !== $existingRequest) {
            return $this->json([
                'error' => 'Für diese E-Mail-Adresse liegt bereits eine offene Demo-Anfrage vor.',
            ], 409);
        }

        $demoRequest = new DemoRequest();
        $demoRequest->setName(trim((string) ($data['name'] ?? '')));
        $demoRequest->setEmail($email);
        $demoRequest->setClubName(isset($data['clubName']) && '' !== trim((string) $data['clubName']) ? trim((string) $data['clubName']) : null);
        $demoRequest->setLeague(isset($data['league']) && '' !== trim((string) $data['league']) ? trim((string) $data['league']) : null);
        $demoRequest->setAgeGroup(isset($data['ageGroup']) && '' !== trim((string) $data['ageGroup']) ? trim((string) $data['ageGroup']) : null);
        $demoRequest->setPhone(isset($data['phone']) && '' !== trim((string) $data['phone']) ? trim((string) $data['phone']) : null);
        $demoRequest->setMessage(isset($data['message']) && '' !== trim((string) $data['message']) ? trim((string) $data['message']) : null);

        $this->em->persist($demoRequest);
        $this->em->flush();

        $this->notificationService->notifySuperadminsAboutNewRequest($demoRequest);
        $this->notificationService->sendConfirmationToRequester($demoRequest);

        return $this->json(['success' => true], 201);
    }
}
