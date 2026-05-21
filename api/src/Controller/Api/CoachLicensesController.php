<?php

namespace App\Controller\Api;

use App\Entity\CoachLicense;
use App\Security\Voter\CoachLicenseVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/coach-licenses', name: 'api_coach_licenses_')]
class CoachLicensesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $coachLicenses = $this->entityManager->getRepository(CoachLicense::class)->findAll();

        // Filtere Trainerlizenzen basierend auf VIEW-Berechtigung
        $coachLicenses = array_filter($coachLicenses, fn ($coachLicense) => $this->isGranted(CoachLicenseVoter::VIEW, $coachLicense));

        return $this->json(
            [
                'coachLicenses' => array_map(fn ($coachLicense) => [
                    'id' => $coachLicense->getId(),
                    'name' => $coachLicense->getName(),
                    'description' => $coachLicense->getDescription(),
                    'countryCode' => $coachLicense->getCountryCode(),
                    'permissions' => [
                        'canView' => $this->isGranted(CoachLicenseVoter::VIEW, $coachLicense),
                        'canCreate' => $this->isGranted(CoachLicenseVoter::CREATE, $coachLicense),
                        'canEdit' => $this->isGranted(CoachLicenseVoter::EDIT, $coachLicense),
                        'canDelete' => $this->isGranted(CoachLicenseVoter::DELETE, $coachLicense)
                    ]
                ], $coachLicenses)
            ]
        );
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(CoachLicense $coachLicense): JsonResponse
    {
        if (!$this->isGranted(CoachLicenseVoter::VIEW, $coachLicense)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'coachLicense' => [
                    'id' => $coachLicense->getId(),
                    'name' => $coachLicense->getName(),
                    'description' => $coachLicense->getDescription(),
                    'countryCode' => $coachLicense->getCountryCode(),
                    'permissions' => [
                        'canView' => $this->isGranted(CoachLicenseVoter::VIEW, $coachLicense),
                        'canCreate' => $this->isGranted(CoachLicenseVoter::CREATE, $coachLicense),
                        'canEdit' => $this->isGranted(CoachLicenseVoter::EDIT, $coachLicense),
                        'canDelete' => $this->isGranted(CoachLicenseVoter::DELETE, $coachLicense)
                    ]
                ]
            ]
        );
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $coachLicense = new CoachLicense();

        if (!$this->isGranted(CoachLicenseVoter::CREATE, $coachLicense)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $coachLicenseData = json_decode($request->getContent(), true);
        $coachLicense->setName($coachLicenseData['name']);
        $coachLicense->setDescription($coachLicenseData['description']);
        $coachLicense->setCountryCode($coachLicenseData['countryCode']);

        $this->entityManager->persist($coachLicense);
        $this->entityManager->flush();

        return $this->json(['message' => 'Coach License created successfully', 'coachLicense' => [
            'id' => $coachLicense->getId(),
            'name' => $coachLicense->getName(),
            'description' => $coachLicense->getDescription(),
            'countryCode' => $coachLicense->getCountryCode(),
            'permissions' => [
                'canView' => $this->isGranted(CoachLicenseVoter::VIEW, $coachLicense),
                'canCreate' => $this->isGranted(CoachLicenseVoter::CREATE, $coachLicense),
                'canEdit' => $this->isGranted(CoachLicenseVoter::EDIT, $coachLicense),
                'canDelete' => $this->isGranted(CoachLicenseVoter::DELETE, $coachLicense)
            ]
        ]], 201);
    }

    #[Route('/{id}', methods: ['PUT'], name: 'update')]
    public function update(CoachLicense $coachLicense, Request $request): JsonResponse
    {
        if (!$this->isGranted(CoachLicenseVoter::EDIT, $coachLicense)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $coachLicenseData = json_decode($request->getContent(), true);
        $coachLicense->setName($coachLicenseData['name']);
        $coachLicense->setDescription($coachLicenseData['description']);
        $coachLicense->setCountryCode($coachLicenseData['countryCode']);

        $this->entityManager->flush();

        return $this->json(['message' => 'Coach License updated successfully', 'coachLicense' => [
            'id' => $coachLicense->getId(),
            'name' => $coachLicense->getName(),
            'description' => $coachLicense->getDescription(),
            'countryCode' => $coachLicense->getCountryCode(),
            'permissions' => [
                'canView' => $this->isGranted(CoachLicenseVoter::VIEW, $coachLicense),
                'canCreate' => $this->isGranted(CoachLicenseVoter::CREATE, $coachLicense),
                'canEdit' => $this->isGranted(CoachLicenseVoter::EDIT, $coachLicense),
                'canDelete' => $this->isGranted(CoachLicenseVoter::DELETE, $coachLicense)
            ]
        ]]);
    }

    #[Route('/{id}', methods: ['DELETE'], name: 'delete')]
    public function delete(CoachLicense $coachLicense): JsonResponse
    {
        if (!$this->isGranted(CoachLicenseVoter::DELETE, $coachLicense)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($coachLicense);
        $this->entityManager->flush();

        return $this->json(['message' => 'Coach License deleted successfully']);
    }
}
