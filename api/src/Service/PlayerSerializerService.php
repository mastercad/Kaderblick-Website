<?php

namespace App\Service;

use App\Entity\GameEvent;
use App\Entity\Player;
use App\Entity\PlayerGameStats;
use App\Security\Voter\PlayerVoter;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Centralises the serialisation of a Player to the canonical API shape
 * used by PlayersController::show() and WatchlistController.
 *
 * Keeping the logic here means a single place to change when data / DSGVO
 * requirements change.
 */
class PlayerSerializerService
{
    public function __construct(
        private Security $security,
        private CoachTeamPlayerService $coachTeamPlayerService,
        private EntityManagerInterface $entityManager,
        private AdminScopeService $adminScopeService,
    ) {
    }

    /**
     * Returns the full player data array for the currently authenticated user.
     * Includes scope-aware permissions and aggregated game stats.
     *
     * @return array<string, mixed>
     */
    public function serializeForCurrentUser(Player $player): array
    {
        /** @var \App\Entity\User $viewer */
        $viewer = $this->security->getUser();
        $isSuperAdmin = $this->security->isGranted('ROLE_SUPERADMIN');
        $coachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($viewer));
        $adminTeamIds = array_keys($this->adminScopeService->getAdministeredTeams($viewer));

        // Full scope = admin, OR every *active* PTA belongs to one of the coach's teams.
        $now = new DateTime('today');
        $activeAssignments = array_filter(
            $player->getPlayerTeamAssignments()->toArray(),
            fn ($pta) => null === $pta->getEndDate() || $pta->getEndDate() >= $now
        );
        $playerTeamIds = array_map(fn ($pta) => $pta->getTeam()->getId(), $activeAssignments);
        $isFullScope = $isSuperAdmin || 0 === count(array_diff($playerTeamIds, array_unique(array_merge($coachTeamIds, $adminTeamIds))));

        return [
            'id' => $player->getId(),
            'firstName' => $player->getFirstName(),
            'lastName' => $player->getLastName(),
            'fullName' => $player->getFullName(),
            'birthdate' => $player->getBirthdate()?->format('Y-m-d'),
            'height' => $player->getHeight(),
            'weight' => $player->getWeight(),
            'strongFeet' => [
                'id' => $player->getStrongFoot()?->getId(),
                'name' => $player->getStrongFoot()?->getName(),
            ],
            'mainPosition' => [
                'id' => $player->getMainPosition()->getId(),
                'name' => $player->getMainPosition()->getName(),
            ],
            'alternativePositions' => array_map(fn ($p) => [
                'id' => $p->getId(),
                'name' => $p->getName(),
            ], $player->getAlternativePositions()->toArray()),
            'clubAssignments' => array_map(fn ($a) => [
                'id' => $a->getId(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
                'club' => [
                    'id' => $a->getClub()->getId(),
                    'name' => $a->getClub()->getName(),
                ],
            ], $player->getPlayerClubAssignments()->toArray()),
            'nationalityAssignments' => array_map(fn ($a) => [
                'id' => $a->getId(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
                'nationality' => [
                    'id' => $a->getNationality()->getId(),
                    'name' => $a->getNationality()->getName(),
                ],
            ], $player->getPlayerNationalityAssignments()->toArray()),
            'teamAssignments' => array_map(fn ($a) => [
                'id' => $a->getId(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
                'shirtNumber' => $a->getShirtNumber(),
                'team' => [
                    'id' => $a->getTeam()->getId(),
                    'name' => $a->getTeam()->getName(),
                    'ageGroup' => [
                        'id' => $a->getTeam()->getAgeGroup()->getId(),
                        'name' => $a->getTeam()->getAgeGroup()->getName(),
                    ],
                ],
                'type' => [
                    'id' => $a->getPlayerTeamAssignmentType()?->getId(),
                    'name' => $a->getPlayerTeamAssignmentType()?->getName(),
                ],
                'canEdit' => $isSuperAdmin
                    || in_array($a->getTeam()->getId(), $adminTeamIds, true)
                    || in_array($a->getTeam()->getId(), $coachTeamIds, true),
            ], $player->getPlayerTeamAssignments()->toArray()),
            'fussballDeUrl' => $player->getFussballDeUrl(),
            'fussballDeId' => $player->getFussballDeId(),
            'stats' => $this->buildStats($player),
            'permissions' => [
                'canView' => $this->security->isGranted(PlayerVoter::VIEW, $player),
                'canEdit' => $this->security->isGranted(PlayerVoter::EDIT, $player),
                'canEditStammdaten' => $isFullScope,
                'coachTeamIds' => $coachTeamIds,
                'canCreate' => $this->security->isGranted(PlayerVoter::CREATE, $player),
                'canDelete' => $this->security->isGranted(PlayerVoter::DELETE, $player),
            ],
        ];
    }

    /**
     * Aggregates game events and game stats for a player.
     *
     * @return array<string, mixed>
     */
    private function buildStats(Player $player): array
    {
        // Event counts per type (goals, assists, yellow cards, …)
        $eventRows = $this->entityManager->createQueryBuilder()
            ->select('get.name AS typeName, COUNT(ge.id) AS cnt')
            ->from(GameEvent::class, 'ge')
            ->join('ge.gameEventType', 'get')
            ->andWhere('ge.player = :player')
            ->setParameter('player', $player)
            ->groupBy('get.id')
            ->orderBy('cnt', 'DESC')
            ->getQuery()
            ->getArrayResult();

        // Aggregated minutes / games
        $agg = $this->entityManager->createQueryBuilder()
            ->select('SUM(pgs.minutesPlayed) AS totalMinutes, COUNT(pgs.id) AS totalGames')
            ->from(PlayerGameStats::class, 'pgs')
            ->andWhere('pgs.player = :player')
            ->setParameter('player', $player)
            ->getQuery()
            ->getOneOrNullResult();

        return [
            'eventCounts' => array_map(fn ($e) => [
                'type' => $e['typeName'],
                'count' => (int) $e['cnt'],
            ], $eventRows),
            'totalGames' => (int) ($agg['totalGames'] ?? 0),
            'totalMinutesPlayed' => (int) ($agg['totalMinutes'] ?? 0),
        ];
    }
}
