<?php

namespace App\Controller;

use App\Entity\Club;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\ClubRepository;
use App\Repository\TeamRepository;
use App\Service\UserContactService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Provides the set of teams and clubs the current user may bulk-message into.
 *
 * ROLE_SUPERADMIN sees everything. Other users see only their own orgs.
 */
#[Route('/api/messaging')]
class MessagingTargetController extends AbstractController
{
    public function __construct(
        private TeamRepository $teamRepository,
        private ClubRepository $clubRepository,
        private UserContactService $userContactService,
    ) {
    }

    #[Route('/teams', name: 'api_messaging_teams', methods: ['GET'])]
    public function teams(): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        $teams = $this->isGranted('ROLE_SUPERADMIN')
            ? $this->teamRepository->findBy([], ['name' => 'ASC'])
            : $this->resolveOwnTeams($user);

        return $this->json([
            'teams' => array_map(
                static fn (Team $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $teams
            ),
        ]);
    }

    #[Route('/clubs', name: 'api_messaging_clubs', methods: ['GET'])]
    public function clubs(): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['message' => 'Unauthorized'], 401);
        }

        $clubs = $this->isGranted('ROLE_SUPERADMIN')
            ? $this->clubRepository->findBy(['active' => true], ['name' => 'ASC'])
            : $this->resolveOwnClubs($user);

        return $this->json([
            'clubs' => array_map(
                static fn (Club $c) => ['id' => $c->getId(), 'name' => $c->getName()],
                $clubs
            ),
        ]);
    }

    /** @return Team[] */
    private function resolveOwnTeams(User $user): array
    {
        $context = $this->userContactService->collectMyTeamsAndClubs($user);
        if (empty($context['teamIds'])) {
            return [];
        }
        $teams = $this->teamRepository->findBy(['id' => array_keys($context['teamIds'])]);
        usort($teams, static fn (Team $a, Team $b) => strcmp($a->getName(), $b->getName()));

        return $teams;
    }

    /** @return Club[] */
    private function resolveOwnClubs(User $user): array
    {
        $context = $this->userContactService->collectMyTeamsAndClubs($user);
        if (empty($context['clubIds'])) {
            return [];
        }
        $clubs = $this->clubRepository->findBy(['id' => array_keys($context['clubIds'])]);
        usort($clubs, static fn (Club $a, Club $b) => strcmp($a->getName(), $b->getName()));

        return $clubs;
    }
}
