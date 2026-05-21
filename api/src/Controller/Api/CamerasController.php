<?php

namespace App\Controller\Api;

use App\Entity\Camera;
use App\Entity\User;
use App\Security\Voter\CameraVoter;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/cameras', name: 'api_cameras_')]
class CamerasController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $cameras = $this->entityManager->getRepository(Camera::class)->findAll();

        // Filtere Kameras basierend auf VIEW-Berechtigung
        $cameras = array_filter($cameras, fn ($camera) => $this->isGranted(CameraVoter::VIEW, $camera));

        return $this->json(
            [
                'cameras' => array_map(fn ($camera) => [
                    'id' => $camera->getId(),
                    'name' => $camera->getName(),
                    'createdAt' => $camera->getCreatedAt()?->format('Y-m-d H:i:s'),
                    'updatedAt' => $camera->getUpdatedAt()?->format('Y-m-d H:i:s'),
                    'createdFrom' => [
                        'id' => $camera->getCreatedFrom()?->getId(),
                        'fullName' => $camera->getCreatedFrom()?->getFullName()
                    ],
                    'updatedFrom' => $camera->getUpdatedFrom() ? [
                        'id' => $camera->getUpdatedFrom()->getId(),
                        'fullName' => $camera->getUpdatedFrom()->getFullName()
                    ] : null,
                    'permissions' => [
                        'canView' => $this->isGranted(CameraVoter::VIEW, $camera),
                        'canCreate' => $this->isGranted(CameraVoter::CREATE, $camera),
                        'canEdit' => $this->isGranted(CameraVoter::EDIT, $camera),
                        'canDelete' => $this->isGranted(CameraVoter::DELETE, $camera)
                    ]
                ], $cameras)
            ]
        );
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(int $id): JsonResponse
    {
        $camera = $this->entityManager->getRepository(Camera::class)->find($id);

        if (!$camera) {
            return $this->json(['error' => 'Camera not found'], 404);
        }

        if (!$this->isGranted(CameraVoter::VIEW, $camera)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'camera' => [
                    'id' => $camera->getId(),
                    'name' => $camera->getName(),
                    'createdAt' => $camera->getCreatedAt()?->format('Y-m-d H:i:s'),
                    'updatedAt' => $camera->getUpdatedAt()?->format('Y-m-d H:i:s'),
                    'createdFrom' => [
                        'id' => $camera->getCreatedFrom()?->getId(),
                        'fullName' => $camera->getCreatedFrom()?->getFullName()
                    ],
                    'updatedFrom' => $camera->getUpdatedFrom() ? [
                        'id' => $camera->getUpdatedFrom()->getId(),
                        'fullName' => $camera->getUpdatedFrom()->getFullName()
                    ] : null,
                    'permissions' => [
                        'canView' => $this->isGranted(CameraVoter::VIEW, $camera),
                        'canCreate' => $this->isGranted(CameraVoter::CREATE, $camera),
                        'canEdit' => $this->isGranted(CameraVoter::EDIT, $camera),
                        'canDelete' => $this->isGranted(CameraVoter::DELETE, $camera)
                    ]
                ]
            ]
        );
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $camera = new Camera();

        if (!$this->isGranted(CameraVoter::CREATE, $camera)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();

        $cameraData = json_decode($request->getContent(), true);

        if (!isset($cameraData['name']) || empty(trim($cameraData['name']))) {
            return $this->json(['error' => 'Name is required'], 400);
        }

        $camera->setName($cameraData['name']);
        $camera->setCreatedFrom($user);
        $camera->setCreatedAt(new DateTimeImmutable());

        $this->entityManager->persist($camera);
        $this->entityManager->flush();

        return $this->json([
            'message' => 'Camera created successfully',
            'id' => $camera->getId()
        ], 201);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(Camera $camera, Request $request): JsonResponse
    {
        if (!$this->isGranted(CameraVoter::EDIT, $camera)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();

        $cameraData = json_decode($request->getContent(), true);

        if (!isset($cameraData['name']) || empty(trim($cameraData['name']))) {
            return $this->json(['error' => 'Name is required'], 400);
        }

        $camera->setName($cameraData['name']);
        $camera->setUpdatedFrom($user);
        $camera->setUpdatedAt(new DateTimeImmutable());

        $this->entityManager->flush();

        return $this->json(['message' => 'Camera updated successfully']);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Camera $camera): JsonResponse
    {
        if (!$this->isGranted(CameraVoter::DELETE, $camera)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($camera);
        $this->entityManager->flush();

        return $this->json(['message' => 'Camera deleted successfully']);
    }
}
