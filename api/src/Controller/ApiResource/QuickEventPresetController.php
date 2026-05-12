<?php

declare(strict_types=1);

namespace App\Controller\ApiResource;

use App\Entity\QuickEventPreset;
use App\Entity\User;
use App\Repository\QuickEventPresetRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/quick-event-presets', name: 'api_quick_event_presets_')]
class QuickEventPresetController extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    private function getCurrentUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException('Not authenticated.');
        }

        return $user;
    }

    private function isAdmin(): bool
    {
        return $this->isGranted('ROLE_SUPERADMIN') || $this->isGranted('ROLE_SUPPORTER');
    }

    /**
     * Erlaubt: ROLE_SUPERADMIN, ROLE_SUPPORTER oder Benutzer mit einer Trainer-Relation
     * (UserRelation mit relationType.category = 'coach').
     *
     * Gibt null zurück wenn Zugriff erlaubt, sonst eine 403-JsonResponse.
     */
    private function assertAccess(): ?JsonResponse
    {
        if ($this->isGranted('ROLE_SUPERADMIN') || $this->isGranted('ROLE_SUPPORTER')) {
            return null;
        }

        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Not authenticated.'], Response::HTTP_UNAUTHORIZED);
        }
        foreach ($user->getUserRelations() as $relation) {
            if ('coach' === $relation->getRelationType()->getCategory()) {
                return null;
            }
        }

        return $this->json(['error' => 'Requires ROLE_SUPERADMIN, ROLE_SUPPORTER or a coach user relation.'], Response::HTTP_FORBIDDEN);
    }

    /**
     * Gibt alle eigenen sowie freigegebenen Presets zurück.
     * Admins/Supporter sehen alle Presets.
     */
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(QuickEventPresetRepository $repo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        if ($this->isAdmin()) {
            $presets = $repo->findAll();
        } else {
            $presets = $repo->findForUser($this->getCurrentUser());
        }

        return $this->json([
            'presets' => array_map(static fn (QuickEventPreset $p) => $p->toArray(), $presets),
        ]);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $currentUser = $this->getCurrentUser();
        $data = $request->toArray();
        $name = trim((string) ($data['name'] ?? ''));

        if ('' === $name || !array_key_exists('config', $data) || !is_array($data['config'])) {
            return $this->json(['error' => 'name and config are required'], Response::HTTP_BAD_REQUEST);
        }

        $config = $data['config'];

        $preset = new QuickEventPreset($currentUser, $name, $config);
        $this->em->persist($preset);
        $this->em->flush();

        return $this->json($preset->toArray(), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(int $id, Request $request, QuickEventPresetRepository $repo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $preset = $repo->find($id);
        if (null === $preset) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isAdmin() && $preset->getOwner() !== $this->getCurrentUser()) {
            return $this->json(['error' => 'Access denied'], Response::HTTP_FORBIDDEN);
        }

        $data = $request->toArray();

        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ('' === $name) {
                return $this->json(['error' => 'name must not be empty'], Response::HTTP_BAD_REQUEST);
            }
            $preset->setName($name);
        }

        if (array_key_exists('config', $data)) {
            if (!is_array($data['config'])) {
                return $this->json(['error' => 'config must be an array'], Response::HTTP_BAD_REQUEST);
            }
            $preset->setConfig($data['config']);
        }

        $this->em->flush();

        return $this->json($preset->toArray());
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(int $id, QuickEventPresetRepository $repo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $preset = $repo->find($id);
        if (null === $preset) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isAdmin() && $preset->getOwner() !== $this->getCurrentUser()) {
            return $this->json(['error' => 'Access denied'], Response::HTTP_FORBIDDEN);
        }

        $this->em->remove($preset);
        $this->em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/{id}/activate', name: 'activate', methods: ['POST'])]
    public function activate(int $id, QuickEventPresetRepository $repo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $preset = $repo->find($id);
        if (null === $preset) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isAdmin() && $preset->getOwner() !== $this->getCurrentUser()) {
            return $this->json(['error' => 'Access denied'], Response::HTTP_FORBIDDEN);
        }

        foreach ($repo->findAll() as $p) {
            if ($p !== $preset) {
                $p->setActive(false);
            }
        }
        $preset->setActive(true);
        $this->em->flush();

        return $this->json($preset->toArray());
    }

    #[Route('/{id}/deactivate', name: 'deactivate', methods: ['POST'])]
    public function deactivate(int $id, QuickEventPresetRepository $repo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $preset = $repo->find($id);
        if (null === $preset) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isAdmin() && $preset->getOwner() !== $this->getCurrentUser()) {
            return $this->json(['error' => 'Access denied'], Response::HTTP_FORBIDDEN);
        }

        $preset->setActive(false);
        $this->em->flush();

        return $this->json($preset->toArray());
    }

    /**
     * Teilt ein Preset mit einer Liste von Benutzern (ersetzt die bisherige Freigabeliste vollständig).
     * Body: { "userIds": [1, 2, 3] }.
     */
    #[Route('/{id}/share', name: 'share', methods: ['POST'])]
    public function share(int $id, Request $request, QuickEventPresetRepository $repo, UserRepository $userRepo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $preset = $repo->find($id);
        if (null === $preset) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->isAdmin() && $preset->getOwner() !== $this->getCurrentUser()) {
            return $this->json(['error' => 'Access denied'], Response::HTTP_FORBIDDEN);
        }

        $data = $request->toArray();
        $userIds = $data['userIds'] ?? [];
        if (!is_array($userIds)) {
            return $this->json(['error' => 'userIds must be an array'], Response::HTTP_BAD_REQUEST);
        }

        $preset->clearSharedWith();
        foreach ($userIds as $userId) {
            $user = $userRepo->find((int) $userId);
            if (null !== $user) {
                $preset->addSharedWith($user);
            }
        }

        $this->em->flush();

        return $this->json($preset->toArray());
    }

    /**
     * Erstellt eine eigene Kopie eines freigegebenen Presets.
     */
    #[Route('/{id}/copy', name: 'copy', methods: ['POST'])]
    public function copy(int $id, QuickEventPresetRepository $repo): JsonResponse
    {
        if ($response = $this->assertAccess()) {
            return $response;
        }

        $currentUser = $this->getCurrentUser();

        $source = $repo->find($id);
        if (null === $source) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $isOwner = $source->getOwner() === $currentUser;
        $isSharedWithUser = $source->getSharedWith()->contains($currentUser);
        if (!$this->isAdmin() && !$isOwner && !$isSharedWithUser) {
            return $this->json(['error' => 'Access denied'], Response::HTTP_FORBIDDEN);
        }

        $copy = new QuickEventPreset($currentUser, $source->getName() . ' (Kopie)', $source->getConfig());
        $this->em->persist($copy);
        $this->em->flush();

        return $this->json($copy->toArray(), Response::HTTP_CREATED);
    }
}
