<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Entity\VideoType;
use App\Security\Voter\VideoTypeVoter;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/video-types', name: 'api_video_types_')]
class VideoTypesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $videoTypes = $this->entityManager->getRepository(VideoType::class)->findBy([], ['sort' => 'ASC']);

        // Filtere VideoTypes basierend auf VIEW-Berechtigung
        $videoTypes = array_filter($videoTypes, fn ($videoType) => $this->isGranted(VideoTypeVoter::VIEW, $videoType));

        return $this->json(
            [
                'videoTypes' => array_map(fn ($videoType) => [
                    'id' => $videoType->getId(),
                    'name' => $videoType->getName(),
                    'sort' => $videoType->getSort(),
                    'createdAt' => $videoType->getCreatedAt()?->format('Y-m-d H:i:s'),
                    'updatedAt' => $videoType->getUpdatedAt()?->format('Y-m-d H:i:s'),
                    'createdFrom' => [
                        'id' => $videoType->getCreatedFrom()?->getId(),
                        'fullName' => $videoType->getCreatedFrom()?->getFullName()
                    ],
                    'updatedFrom' => [
                        'id' => $videoType->getUpdatedFrom()?->getId(),
                        'fullName' => $videoType->getUpdatedFrom()?->getFullName()
                    ],
                    'permissions' => [
                        'canView' => $this->isGranted(VideoTypeVoter::VIEW, $videoType),
                        'canCreate' => $this->isGranted(VideoTypeVoter::CREATE, $videoType),
                        'canEdit' => $this->isGranted(VideoTypeVoter::EDIT, $videoType),
                        'canDelete' => $this->isGranted(VideoTypeVoter::DELETE, $videoType)
                    ]
                ], $videoTypes)
            ]
        );
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(int $id): JsonResponse
    {
        $videoType = $this->entityManager->getRepository(VideoType::class)->find($id);

        if (!$videoType) {
            return $this->json(['error' => 'VideoType not found'], 404);
        }

        if (!$this->isGranted(VideoTypeVoter::VIEW, $videoType)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'videoType' => [
                    'id' => $videoType->getId(),
                    'name' => $videoType->getName(),
                    'sort' => $videoType->getSort(),
                    'createdAt' => $videoType->getCreatedAt()?->format('Y-m-d H:i:s'),
                    'updatedAt' => $videoType->getUpdatedAt()?->format('Y-m-d H:i:s'),
                    'createdFrom' => [
                        'id' => $videoType->getCreatedFrom()?->getId(),
                        'fullName' => $videoType->getCreatedFrom()?->getFullName()
                    ],
                    'updatedFrom' => [
                        'id' => $videoType->getUpdatedFrom()?->getId(),
                        'fullName' => $videoType->getUpdatedFrom()?->getFullName()
                    ],
                    'permissions' => [
                        'canView' => $this->isGranted(VideoTypeVoter::VIEW, $videoType),
                        'canCreate' => $this->isGranted(VideoTypeVoter::CREATE, $videoType),
                        'canEdit' => $this->isGranted(VideoTypeVoter::EDIT, $videoType),
                        'canDelete' => $this->isGranted(VideoTypeVoter::DELETE, $videoType)
                    ]
                ]
            ]
        );
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $videoType = new VideoType();

        if (!$this->isGranted(VideoTypeVoter::CREATE, $videoType)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();

        $videoTypeData = json_decode($request->getContent(), true);

        if (!isset($videoTypeData['name']) || empty(trim($videoTypeData['name']))) {
            return $this->json(['error' => 'Name is required'], 400);
        }

        if (!isset($videoTypeData['sort']) || !is_numeric($videoTypeData['sort'])) {
            return $this->json(['error' => 'Sort order is required and must be numeric'], 400);
        }

        $videoType->setName($videoTypeData['name']);
        $videoType->setSort((int) $videoTypeData['sort']);
        $videoType->setCreatedFrom($user);
        $videoType->setUpdatedFrom($user);
        $videoType->setCreatedAt(new DateTimeImmutable());
        $videoType->setUpdatedAt(new DateTimeImmutable());

        $this->entityManager->persist($videoType);
        $this->entityManager->flush();

        return $this->json([
            'message' => 'VideoType created successfully',
            'id' => $videoType->getId()
        ], 201);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(VideoType $videoType, Request $request): JsonResponse
    {
        if (!$this->isGranted(VideoTypeVoter::EDIT, $videoType)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();

        $videoTypeData = json_decode($request->getContent(), true);

        if (!isset($videoTypeData['name']) || empty(trim($videoTypeData['name']))) {
            return $this->json(['error' => 'Name is required'], 400);
        }

        if (!isset($videoTypeData['sort']) || !is_numeric($videoTypeData['sort'])) {
            return $this->json(['error' => 'Sort order is required and must be numeric'], 400);
        }

        $videoType->setName($videoTypeData['name']);
        $videoType->setSort((int) $videoTypeData['sort']);
        $videoType->setUpdatedFrom($user);
        $videoType->setUpdatedAt(new DateTimeImmutable());

        $this->entityManager->flush();

        return $this->json(['message' => 'VideoType updated successfully']);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(VideoType $videoType): JsonResponse
    {
        if (!$this->isGranted(VideoTypeVoter::DELETE, $videoType)) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $this->entityManager->remove($videoType);
        $this->entityManager->flush();

        return $this->json(['message' => 'VideoType deleted successfully']);
    }
}
