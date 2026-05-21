<?php

namespace App\Controller\ApiResource;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\TacticPreset;
use App\Entity\User;
use App\Repository\TacticPresetRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * REST endpoints for tactic presets.
 *
 * GET    /api/tactic-presets          List system + club + personal presets
 * POST   /api/tactic-presets          Save current tactic as a (team) preset
 * DELETE /api/tactic-presets/{id}     Delete own preset
 */
#[Route('/api/tactic-presets', name: 'api_tactic_preset_')]
class TacticPresetController extends AbstractController
{
    public function __construct(
        private readonly TacticPresetRepository $presetRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    // -----------------------------------------------------------------
    // GET /api/tactic-presets
    // -----------------------------------------------------------------

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();

        if (null === $user) {
            return new JsonResponse(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        $clubs = $this->getUserClubs($user);
        $presets = $this->presetRepository->findVisibleForUser($user, $clubs);

        return new JsonResponse(
            array_map(fn (TacticPreset $p) => $p->toArray($user), $presets)
        );
    }

    // -----------------------------------------------------------------
    // POST /api/tactic-presets
    // -----------------------------------------------------------------

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();

        if (null === $user) {
            return new JsonResponse(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        /** @var array<string, mixed>|null $body */
        $body = json_decode($request->getContent(), true);

        if (!is_array($body)) {
            return new JsonResponse(['error' => 'Invalid JSON'], Response::HTTP_BAD_REQUEST);
        }

        // --- Validate required fields ---
        $title = trim((string) ($body['title'] ?? ''));
        $category = trim((string) ($body['category'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $shareWithClub = (bool) ($body['shareWithClub'] ?? false);
        $data = $body['data'] ?? null;

        if ('' === $title || '' === $category || !is_array($data)) {
            return new JsonResponse(
                ['error' => 'title, category and data are required'],
                Response::HTTP_BAD_REQUEST
            );
        }

        if (!in_array($category, TacticPreset::CATEGORIES, true)) {
            return new JsonResponse(
                ['error' => 'Invalid category. Allowed: ' . implode(', ', TacticPreset::CATEGORIES)],
                Response::HTTP_BAD_REQUEST
            );
        }

        // --- Build entity ---
        $preset = new TacticPreset();
        $preset->setTitle($title);
        $preset->setCategory($category);
        $preset->setDescription($description);
        $preset->setData($data);
        $preset->setIsSystem(false);
        $preset->setCreatedBy($user);

        // Optionally share with the first club the user belongs to
        if ($shareWithClub) {
            $clubs = $this->getUserClubs($user);
            if ([] !== $clubs) {
                $preset->setClub($clubs[0]);
            }
        }

        $this->entityManager->persist($preset);
        $this->entityManager->flush();

        return new JsonResponse($preset->toArray($user), Response::HTTP_CREATED);
    }

    // -----------------------------------------------------------------
    // DELETE /api/tactic-presets/{id}
    // -----------------------------------------------------------------

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(TacticPreset $preset): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();

        if (null === $user) {
            return new JsonResponse(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
        }

        // Only the creator may delete a preset; system presets are protected
        if ($preset->isSystem() || $preset->getCreatedBy()?->getId() !== $user->getId()) {
            return new JsonResponse(['error' => 'Forbidden'], Response::HTTP_FORBIDDEN);
        }

        $this->entityManager->remove($preset);
        $this->entityManager->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    // -----------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------

    /**
     * Collects all Club entities the given user belongs to via their
     * coach–club assignments.
     *
     * @return Club[]
     */
    private function getUserClubs(User $user): array
    {
        $clubs = [];

        foreach ($user->getUserRelations() as $relation) {
            $coach = $relation->getCoach();

            if (!$coach instanceof Coach) {
                continue;
            }

            foreach ($coach->getCoachClubAssignments() as $assignment) {
                $club = $assignment->getClub();

                if (null !== $club) {
                    $clubs[$club->getId() ?? 0] = $club;
                }
            }
        }

        return array_values($clubs);
    }
}
