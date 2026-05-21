<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\CoachTeamPlayerService;
use App\Service\SizeGuidePdfService;
use DateTime;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

class TeamSizeGuideController extends AbstractController
{
    public function __construct(
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
        private readonly SizeGuidePdfService $sizeGuidePdfService,
    ) {
    }

    #[Route('/api/teams/size-guide-overview', name: 'api_teams_size_guide_overview', methods: ['GET'])]
    public function sizeGuideOverview(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        // Nur aktuell aktive Team-Zuordnungen des eingeloggten Coaches
        $activeTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

        $result = [];
        $now = new DateTime();

        foreach ($activeTeams as $team) {
            $players = [];

            foreach ($team->getPlayerTeamAssignments() as $teamAssignment) {
                // Nur aktive Spieler-Zuordnungen berücksichtigen
                $start = $teamAssignment->getStartDate();
                $end = $teamAssignment->getEndDate();

                if ($start && $start > $now) {
                    continue;
                }
                if ($end && $end < $now) {
                    continue;
                }

                $player = $teamAssignment->getPlayer();

                foreach ($player->getUserRelations() as $playerRelation) {
                    /** @var UserRelation $playerRelation */
                    if ('self_player' !== $playerRelation->getRelationType()->getIdentifier()) {
                        continue 2;
                    }

                    $playerUser = $playerRelation->getUser();
                    $players[] = [
                        'id' => $player->getId(),
                        'name' => $player->getFullname(),
                        'shorts_size' => $playerUser->getPantsSize(),
                        'shirt_size' => $playerUser->getShirtSize(),
                        'shoe_size' => null !== $playerUser->getShoeSize() ? (string) $playerUser->getShoeSize() : null,
                        'socks_size' => $playerUser->getSocksSize(),
                        'jacket_size' => $playerUser->getJacketSize(),
                    ];
                }
            }

            $result[] = [
                'team_id' => $team->getId(),
                'team_name' => $team->getName(),
                'players' => $players,
            ];
        }

        return $this->json($result);
    }

    /** Generate and download a PDF order overview for a specific team's sizes. */
    #[Route('/api/teams/{teamId}/size-guide-pdf', name: 'api_teams_size_guide_pdf', methods: ['GET'])]
    public function sizeGuidePdf(int $teamId): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        $activeTeams = $this->coachTeamPlayerService->collectCoachTeams($user);

        $targetTeam = null;
        foreach ($activeTeams as $team) {
            if ($team->getId() === $teamId) {
                $targetTeam = $team;
                break;
            }
        }

        if (null === $targetTeam) {
            throw new NotFoundHttpException('Team not found or access denied.');
        }

        $players = [];
        $now = new DateTime();

        foreach ($targetTeam->getPlayerTeamAssignments() as $teamAssignment) {
            $start = $teamAssignment->getStartDate();
            $end = $teamAssignment->getEndDate();

            if ($start && $start > $now) {
                continue;
            }
            if ($end && $end < $now) {
                continue;
            }

            $player = $teamAssignment->getPlayer();

            foreach ($player->getUserRelations() as $playerRelation) {
                /** @var UserRelation $playerRelation */
                if ('self_player' !== $playerRelation->getRelationType()->getIdentifier()) {
                    continue 2;
                }

                $playerUser = $playerRelation->getUser();
                $players[] = [
                    'id' => $player->getId(),
                    'name' => $player->getFullname(),
                    'shorts_size' => $playerUser->getPantsSize(),
                    'shirt_size' => $playerUser->getShirtSize(),
                    'shoe_size' => null !== $playerUser->getShoeSize() ? (string) $playerUser->getShoeSize() : null,
                    'socks_size' => $playerUser->getSocksSize(),
                    'jacket_size' => $playerUser->getJacketSize(),
                ];
            }
        }

        $pdfContent = $this->sizeGuidePdfService->generatePdf($targetTeam->getName(), $players);

        $safeTeamName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $targetTeam->getName()) ?? 'Team';
        $filename = sprintf('Bestelluebersicht_%s_%s.pdf', $safeTeamName, (new DateTime())->format('Y-m-d'));

        return new Response(
            $pdfContent,
            Response::HTTP_OK,
            [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => sprintf('inline; filename="%s"', $filename),
                'Content-Length' => strlen($pdfContent),
            ]
        );
    }
}
