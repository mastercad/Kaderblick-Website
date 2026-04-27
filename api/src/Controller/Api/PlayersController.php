<?php

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\Nationality;
use App\Entity\Player;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerNationalityAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\PlayerTeamAssignmentType;
use App\Entity\Position;
use App\Entity\StrongFoot;
use App\Entity\Team;
use App\Repository\PlayerClubAssignmentRepository;
use App\Repository\PlayerNationalityAssignmentRepository;
use App\Repository\PlayerTeamAssignmentRepository;
use App\Security\Voter\PlayerVoter;
use App\Service\CoachTeamPlayerService;
use App\Service\NotificationService;
use App\Service\PlayerSerializerService;
use DateTime;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/players', name: 'api_players_')]
#[IsGranted('IS_AUTHENTICATED')]
class PlayersController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private CoachTeamPlayerService $coachTeamPlayerService,
        private NotificationService $notificationService,
        private PlayerSerializerService $playerSerializer
    ) {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 25)));
        $search = trim((string) $request->query->get('search', ''));
        $teamId = $request->query->get('teamId');

        // Season filter
        $seasonParam = $request->query->get('season');
        $now = new DateTimeImmutable();
        $currentMonth = (int) $now->format('n');
        $currentYear = (int) $now->format('Y');
        $defaultSeasonYear = $currentMonth >= 7 ? $currentYear : ($currentYear - 1);
        $seasonYear = (null !== $seasonParam && ctype_digit((string) $seasonParam))
            ? (int) $seasonParam
            : $defaultSeasonYear;
        $seasonStart = new DateTimeImmutable("{$seasonYear}-07-01");
        $seasonEnd = new DateTimeImmutable(($seasonYear + 1) . '-06-30 23:59:59');
        $availableSeasons = [];
        for ($y = 2021; $y <= $defaultSeasonYear; ++$y) {
            $availableSeasons[] = $y;
        }

        $searchAll = filter_var($request->query->get('searchAll', false), FILTER_VALIDATE_BOOLEAN);

        $repo = $this->entityManager->getRepository(Player::class);
        $qb = $repo->createQueryBuilder('p');

        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $coachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($user));
        $isCoach = count($coachTeamIds) > 0;

        if ($searchAll) {
            // Spieler-Suche quer über alle Saisons und Vereine (z. B. für "Spieler zuordnen"-Dialog,
            // Leihgaben, Testspieler). Kein Team-Filter – die Schreibrechte werden in update() geprüft.
            // leftJoin damit auch Spieler ohne jede Zuordnung gefunden werden.
            $qb->leftJoin('p.playerTeamAssignments', 'pta');
        } else {
            // Normaler Modus: innerJoin + Saison-Filter
            $qb->innerJoin('p.playerTeamAssignments', 'pta')
               ->andWhere('pta.startDate <= :seasonEnd')
               ->andWhere('pta.endDate IS NULL OR pta.endDate >= :seasonStart')
               ->setParameter('seasonStart', $seasonStart)
               ->setParameter('seasonEnd', $seasonEnd);

            // Additionally filter by team or coach scope
            if ($teamId) {
                $qb->andWhere('pta.team = :teamId')
                   ->setParameter('teamId', (int) $teamId);
            } elseif (!$isAdmin && $isCoach) {
                // Coach sieht nur Spieler aus seinen aktiv zugeordneten Teams
                $qb->andWhere('pta.team IN (:coachTeamIds)')
                   ->setParameter('coachTeamIds', $coachTeamIds);
            }
        }

        // Filter by search (firstName / lastName)
        if ('' !== $search) {
            $qb->andWhere('LOWER(p.firstName) LIKE :search OR LOWER(p.lastName) LIKE :search')
               ->setParameter('search', '%' . strtolower($search) . '%');
        }

        // Count total matching results
        $countQb = clone $qb;
        $countQb->select('COUNT(DISTINCT p.id)');
        $total = (int) $countQb->getQuery()->getSingleScalarResult();

        // Fetch paginated results
        $offset = ($page - 1) * $limit;
        $qb->select('p')
           ->groupBy('p.id')
           ->orderBy('p.lastName', 'ASC')
           ->addOrderBy('p.firstName', 'ASC')
           ->setFirstResult($offset)
           ->setMaxResults($limit);

        $players = $qb->getQuery()->getResult();

        return $this->json([
            'players' => array_map(fn ($player) => [
                'id' => $player->getId(),
                'firstName' => $player->getFirstName(),
                'lastName' => $player->getLastName(),
                'fullName' => $player->getFullName(),
                'birthdate' => $player->getBirthdate()?->format('Y-m-d'),
                'height' => $player->getHeight(),
                'weight' => $player->getWeight(),
                'strongFeet' => [
                    'id' => $player->getStrongFoot()?->getId(),
                    'name' => $player->getStrongFoot()?->getName()
                ],
                'mainPosition' => [
                    'id' => $player->getMainPosition()->getId(),
                    'name' => $player->getMainPosition()->getName()
                ],
                'alternativePositions' => array_map(fn ($position) => [
                    'id' => $position->getId(),
                    'name' => $position->getName()
                ], $player->getAlternativePositions()->toArray()),
                'clubAssignments' => array_map(fn ($assignment) => [
                    'id' => $assignment->getId(),
                    'startDate' => $assignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $assignment->getEndDate()?->format('Y-m-d'),
                    'club' => [
                        'id' => $assignment->getClub()->getId(),
                        'name' => $assignment->getClub()->getName()
                    ]
                ], $player->getPlayerClubAssignments()->toArray()),
                'nationalityAssignments' => array_map(fn ($assignment) => [
                    'id' => $assignment->getId(),
                    'startDate' => $assignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $assignment->getEndDate()?->format('Y-m-d'),
                    'nationality' => [
                        'id' => $assignment->getNationality()->getId(),
                        'name' => $assignment->getNationality()->getName()
                    ]
                ], $player->getPlayerNationalityAssignments()->toArray()),
                'teamAssignments' => array_map(fn ($assignment) => [
                    'id' => $assignment->getId(),
                    'startDate' => $assignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $assignment->getEndDate()?->format('Y-m-d'),
                    'shirtNumber' => $assignment->getShirtNumber(),
                    'team' => [
                        'id' => $assignment->getTeam()->getId(),
                        'name' => $assignment->getTeam()->getName(),
                        'ageGroup' => [
                            'id' => $assignment->getTeam()->getAgeGroup()->getId(),
                            'name' => $assignment->getTeam()->getAgeGroup()->getName()
                        ]
                    ],
                    'type' => [
                        'id' => $assignment->getPlayerTeamAssignmentType()?->getId(),
                        'name' => $assignment->getPlayerTeamAssignmentType()?->getName()
                    ]
                ], $player->getPlayerTeamAssignments()->toArray()),
                'fussballDeUrl' => $player->getFussballDeUrl(),
                'fussballDeId' => $player->getFussballDeId(),
                'permissions' => (static function () use ($player, $isAdmin, $isCoach, $coachTeamIds): array {
                    $playerTeamIds = array_map(
                        fn ($pta) => $pta->getTeam()->getId(),
                        $player->getPlayerTeamAssignments()->toArray()
                    );
                    $coachCanManage = $isCoach && count(array_intersect($playerTeamIds, $coachTeamIds)) > 0;

                    return [
                        'canView' => true,
                        'canEdit' => $isAdmin || $coachCanManage,
                        'canCreate' => $isAdmin || $isCoach,
                        'canDelete' => $isAdmin || $coachCanManage,
                    ];
                })()
            ], $players),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'availableSeasons' => $availableSeasons,
            'selectedSeason' => $seasonYear,
        ]);
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(Player $player): JsonResponse
    {
        if (!$this->isGranted(PlayerVoter::VIEW, $player)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        return $this->json(['player' => $this->playerSerializer->serializeForCurrentUser($player)]);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $player = new Player();

        if (!$this->isGranted(PlayerVoter::CREATE, $player)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        $player->setFirstName($data['firstName']);
        $player->setLastName($data['lastName']);
        $player->setEmail($data['email'] ?? '');
        $player->setBirthdate(isset($data['birthdate']) ? new DateTime($data['birthdate']) : null);

        if (isset($data['mainPosition']['id'])) {
            $mainPosition = $this->entityManager->getRepository(Position::class)->find($data['mainPosition']['id']);
            if (null !== $mainPosition) {
                $player->setMainPosition($mainPosition);
            }
        }

        if (isset($data['strongFeet']['id'])) {
            $strongFeet = $this->entityManager->getRepository(StrongFoot::class)->find($data['strongFeet']['id']);
            $player->setStrongFoot($strongFeet);
        }

        $newAlternativePositions = [];
        foreach (($data['alternativePositions'] ?? []) as $alternativePosition) {
            if (isset($alternativePosition['id']) && !in_array($alternativePosition['id'], $newAlternativePositions)) {
                $position = $this->entityManager->getRepository(Position::class)->find($alternativePosition['id']);
                if ($position && $position !== $player->getMainPosition()) {
                    $player->addAlternativePosition($position);
                    $newAlternativePositions[] = $position;
                }
            }
        }

        $player->setAlternativePositions(new ArrayCollection($newAlternativePositions));

        foreach (($data['clubAssignments'] ?? []) as $clubAssignment) {
            $club = $this->entityManager->getRepository(Club::class)->find($clubAssignment['club']['id']);
            $playerClubAssignment = new PlayerClubAssignment();
            $playerClubAssignment->setPlayer($player);
            $playerClubAssignment->setStartDate(isset($clubAssignment['startDate']) ? new DateTime($clubAssignment['startDate']) : null);
            $playerClubAssignment->setEndDate((isset($clubAssignment['endDate']) && !empty($clubAssignment['endDate'])) ? new DateTime($clubAssignment['endDate']) : null);
            $playerClubAssignment->setClub($club);

            $this->entityManager->persist($playerClubAssignment);
        }
        /*
                foreach (($data['licenseAssignments'] ?? []) as $licenseAssignment) {
                    $license = $this->entityManager->getRepository(PlayerLicense::class)->find($licenseAssignment['license']['id']);
                    $playerLicenseAssignment = new PlayerLicenseAssignment();
                    $playerLicenseAssignment->setPlayer($player);
                    $playerLicenseAssignment->setStartDate(isset($licenseAssignment['startDate']) ? new DateTime($licenseAssignment['startDate']) : null);
                    $playerLicenseAssignment->setEndDate(isset($licenseAssignment['endDate']) ? new DateTime($licenseAssignment['endDate']) : null);
                    $playerLicenseAssignment->setLicense($license);

                    $this->entityManager->persist($playerLicenseAssignment);
                }
        */
        foreach (($data['nationalityAssignments'] ?? []) as $nationalityAssignment) {
            $nationality = $this->entityManager->getRepository(Nationality::class)->find($nationalityAssignment['nationality']['id']);
            $playerNationalityAssignment = new PlayerNationalityAssignment();
            $playerNationalityAssignment->setPlayer($player);
            $playerNationalityAssignment->setStartDate(isset($nationalityAssignment['startDate']) ? new DateTime($nationalityAssignment['startDate']) : null);
            $playerNationalityAssignment->setEndDate((isset($nationalityAssignment['endDate'])
                && !empty($nationalityAssignment['endDate'])) ? new DateTime($nationalityAssignment['endDate']) : null);
            $playerNationalityAssignment->setNationality($nationality);

            $this->entityManager->persist($playerNationalityAssignment);
        }

        foreach (($data['teamAssignments'] ?? []) as $teamAssignment) {
            $team = $this->entityManager->getRepository(Team::class)->find($teamAssignment['team']['id']);
            $playerTeamAssignment = new PlayerTeamAssignment();
            $playerTeamAssignment->setPlayer($player);
            $playerTeamAssignment->setShirtNumber($teamAssignment['shirtNumber'] ?? null);
            $playerTeamAssignment->setStartDate(isset($teamAssignment['startDate']) ? new DateTime($teamAssignment['startDate']) : null);
            $playerTeamAssignment->setEndDate((isset($teamAssignment['endDate'])
                && !empty($teamAssignment['endDate'])) ? new DateTime($teamAssignment['endDate']) : null);
            $playerTeamAssignment->setTeam($team);

            $type = $this->entityManager->getRepository(PlayerTeamAssignmentType::class)->find($teamAssignment['type'] ?? null);
            $playerTeamAssignment->setPlayerTeamAssignmentType($type);

            $this->entityManager->persist($playerTeamAssignment);
        }

        $this->entityManager->persist($player);
        $this->entityManager->flush();

        return $this->json(['success' => true], Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(Player $player, Request $request): JsonResponse
    {
        if (!$this->isGranted(PlayerVoter::EDIT, $player)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        /** @var \App\Entity\User $updateUser */
        $updateUser = $this->getUser();
        $updateIsAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $updateCoachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($updateUser));

        // Compute full scope BEFORE any assignments are modified.
        // Full scope = admin OR all of the player's *active* PTAs are in the coach's teams.
        // Active = endDate IS NULL or endDate >= today. Historical PTAs from previous clubs
        // are deliberately excluded so that a fully transferred player (all old PTAs ended)
        // can be claimed by the new club's coach without admin involvement.
        // An empty active PTA list (brand-new or fully transferred player) also yields full scope.
        $updateNow = new DateTime('today');
        $updateActiveAssignments = array_filter(
            $player->getPlayerTeamAssignments()->toArray(),
            fn ($pta) => null === $pta->getEndDate() || $pta->getEndDate() >= $updateNow
        );
        $updatePlayerTeamIds = array_map(
            fn ($pta) => $pta->getTeam()->getId(),
            $updateActiveAssignments
        );
        $updateIsFullScope = $updateIsAdmin
            || 0 === count(array_diff($updatePlayerTeamIds, $updateCoachTeamIds));

        // Stammdaten dürfen nur bei voller Scope-Berechtigung geändert werden
        if ($updateIsFullScope) {
            $player->setFirstName($data['firstName']);
            $player->setLastName($data['lastName']);
            $player->setEmail($data['email'] ?? '');
            $player->setBirthdate(isset($data['birthdate']) ? new DateTime($data['birthdate']) : null);

            if (isset($data['mainPosition']['id'])) {
                $mainPosition = $this->entityManager->getRepository(Position::class)->find($data['mainPosition']['id']);
                if (null !== $mainPosition) {
                    $player->setMainPosition($mainPosition);
                }
            }

            if (isset($data['strongFeet']['id'])) {
                $strongFeet = $this->entityManager->getRepository(StrongFoot::class)->find($data['strongFeet']['id']);
                $player->setStrongFoot($strongFeet);
            }

            $newAlternativePositions = [];
            foreach (($data['alternativePositions'] ?? []) as $alternativePosition) {
                if (isset($alternativePosition['id']) && !key_exists($alternativePosition['id'], $newAlternativePositions)) {
                    $position = $this->entityManager->getRepository(Position::class)->find($alternativePosition['id']);
                    if ($position && $position !== $player->getMainPosition()) {
                        $player->addAlternativePosition($position);
                        $newAlternativePositions[$position->getId()] = $position;
                    }
                }
            }
        }

        /*  $existingPlayerLicenseAssignments = array_map(fn($assignment) =>
            $assignment->getId(), $this->entityManager->getRepository(PlayerLicenseAssignment::class)->findBy(['player' => $player])); */
        $existingPlayerAlternativePositions = array_map(fn ($assignment) => $assignment->getId(), $player->getAlternativePositions()->toArray());
        $existingPlayerNationalities = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(PlayerNationalityAssignment::class)->findBy(['player' => $player])
        );
        $existingPlayerTeams = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(PlayerTeamAssignment::class)->findBy(['player' => $player])
        );
        $existingPlayerClubAssignments = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(PlayerClubAssignment::class)->findBy(['player' => $player])
        );

        // Club- und Nationalitäten-Assignments: nur bei voller Scope-Berechtigung veränderbar
        if ($updateIsFullScope) {
            foreach (($data['clubAssignments'] ?? []) as $clubAssignment) {
                if (isset($clubAssignment['id']) && isset($clubAssignment['club']) && in_array($clubAssignment['id'], $existingPlayerClubAssignments)) {
                    $existingPlayerClubAssignments = array_filter($existingPlayerClubAssignments, fn ($id) => $id !== $clubAssignment['id']);
                }
                if (isset($clubAssignment['id'])) {
                    $playerClubAssignment = $this->entityManager->getRepository(PlayerClubAssignment::class)->find((int) $clubAssignment['id']);
                } else {
                    $playerClubAssignment = new PlayerClubAssignment();
                }

                $club = $this->entityManager->getRepository(Club::class)->find($clubAssignment['club']['id']);
                $playerClubAssignment->setPlayer($player);
                $playerClubAssignment->setStartDate(isset($clubAssignment['startDate']) ? new DateTime($clubAssignment['startDate']) : null);
                $playerClubAssignment->setEndDate((isset($clubAssignment['endDate'])
                    && !empty($clubAssignment['endDate'])) ? new DateTime($clubAssignment['endDate']) : null);
                $playerClubAssignment->setClub($club);

                $this->entityManager->persist($playerClubAssignment);
            }

            /** @var PlayerClubAssignmentRepository $playerClubAssignmentRepository */
            $playerClubAssignmentRepository = $this->entityManager->getRepository(PlayerClubAssignment::class);
            $playerClubAssignmentRepository->deleteByIds($existingPlayerClubAssignments);

            foreach (($data['nationalityAssignments'] ?? []) as $nationalityAssignment) {
                if (
                    isset($nationalityAssignment['id'])
                    && isset($nationalityAssignment['nationality'])
                    && in_array($nationalityAssignment['id'], $existingPlayerNationalities)
                ) {
                    $existingPlayerNationalities = array_filter($existingPlayerNationalities, fn ($id) => $id !== $nationalityAssignment['id']);
                }
                if (isset($nationalityAssignment['id'])) {
                    $playerNationalityAssignment = $this->entityManager->getRepository(PlayerNationalityAssignment::class)->find((int) $nationalityAssignment['id']);
                } else {
                    $playerNationalityAssignment = new PlayerNationalityAssignment();
                }

                $nationality = $this->entityManager->getRepository(Nationality::class)->find($nationalityAssignment['nationality']['id']);
                $playerNationalityAssignment->setPlayer($player);
                $playerNationalityAssignment->setStartDate(isset($nationalityAssignment['startDate']) ? new DateTime($nationalityAssignment['startDate']) : null);
                $playerNationalityAssignment->setEndDate((isset($nationalityAssignment['endDate'])
                    && !empty($nationalityAssignment['endDate'])) ? new DateTime($nationalityAssignment['endDate']) : null);
                $playerNationalityAssignment->setNationality($nationality);

                $this->entityManager->persist($playerNationalityAssignment);
            }

            /** @var PlayerNationalityAssignmentRepository $playerNationalityAssignmentRepository */
            $playerNationalityAssignmentRepository = $this->entityManager->getRepository(PlayerNationalityAssignment::class);
            $playerNationalityAssignmentRepository->deleteByIds($existingPlayerNationalities);
        }

        // Erkennen ob neue Team-Zuordnungen hinzugefügt werden (keine ID = neu)
        $hasNewTeamAssignments = !empty(array_filter(
            $data['teamAssignments'] ?? [],
            fn ($ta) => empty($ta['id'])
        ));

        // Team-Assignments: immer verarbeitbar, aber nur für Teams die der Coach selbst betreut.
        // Assignments für fremde Teams werden weder verändert noch gelöscht.
        foreach (($data['teamAssignments'] ?? []) as $teamAssignment) {
            // Immer aus der "zu löschenden" Liste herausnehmen, unabhängig vom Scope,
            // damit fremde PTAs nicht versehentlich gelöscht werden.
            if (isset($teamAssignment['id']) && in_array((int) $teamAssignment['id'], $existingPlayerTeams)) {
                $existingPlayerTeams = array_values(array_filter($existingPlayerTeams, fn ($id) => $id !== (int) $teamAssignment['id']));
            }

            $team = $this->entityManager->getRepository(Team::class)->find($teamAssignment['team']['id'] ?? null);
            if (!$team) {
                continue;
            }

            // Coach darf nur Assignments für seine eigenen Teams schreiben
            if (!$updateIsAdmin && !in_array($team->getId(), $updateCoachTeamIds)) {
                continue;
            }

            if (isset($teamAssignment['id'])) {
                $playerTeamAssignment = $this->entityManager->getRepository(PlayerTeamAssignment::class)->find((int) $teamAssignment['id']);
            } else {
                $playerTeamAssignment = new PlayerTeamAssignment();
            }
            $playerTeamAssignment->setPlayer($player);
            $playerTeamAssignment->setShirtNumber($teamAssignment['shirtNumber'] ?? null);
            $playerTeamAssignment->setStartDate(isset($teamAssignment['startDate']) ? new DateTime($teamAssignment['startDate']) : null);
            $playerTeamAssignment->setEndDate((isset($teamAssignment['endDate'])
                && !empty($teamAssignment['endDate'])) ? new DateTime($teamAssignment['endDate']) : null);
            $playerTeamAssignment->setTeam($team);

            $type = $this->entityManager->getRepository(PlayerTeamAssignmentType::class)->find($teamAssignment['type'] ?? null);
            $playerTeamAssignment->setPlayerTeamAssignmentType($type);

            $this->entityManager->persist($playerTeamAssignment);
        }

        // Nur PTAs löschen, die zu Teams des aktuellen Coaches gehören.
        // PTAs fremder Teams bleiben immer erhalten.
        /** @var PlayerTeamAssignmentRepository $playerTeamAssignmentRepository */
        $playerTeamAssignmentRepository = $this->entityManager->getRepository(PlayerTeamAssignment::class);
        if (!$updateIsAdmin) {
            $existingPlayerTeams = array_values(array_filter($existingPlayerTeams, function (int $ptaId) use ($updateCoachTeamIds): bool {
                $pta = $this->entityManager->getRepository(PlayerTeamAssignment::class)->find($ptaId);

                return null !== $pta && in_array($pta->getTeam()->getId(), $updateCoachTeamIds);
            }));
        }
        $playerTeamAssignmentRepository->deleteByIds($existingPlayerTeams);

        $this->entityManager->persist($player);
        $this->entityManager->flush();

        if ($hasNewTeamAssignments) {
            $this->notifyPlayerUserRelations(
                $player,
                'Du wurdest einem Team zugeordnet',
                'Ein Trainer hat dich einem Team hinzugefügt. Dein Spielerprofil wurde aktualisiert.'
            );
        }

        return $this->json(['success' => true], Response::HTTP_CREATED);
    }

    #[Route(path: '/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Player $player): JsonResponse
    {
        if (!$this->isGranted(PlayerVoter::DELETE, $player)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $this->entityManager->remove($player);

        $playerClubAssignments = $this->entityManager->getRepository(PlayerClubAssignment::class)->findBy(['player' => $player]);
        foreach ($playerClubAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }

        $playerTeamAssignments = $this->entityManager->getRepository(PlayerTeamAssignment::class)->findBy(['player' => $player]);
        foreach ($playerTeamAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }
        /*
                $playerLicenseAssignments = $this->entityManager->getRepository(PlayerLicenseAssignment::class)->findBy(['player' => $player]);
                foreach ($playerLicenseAssignments as $assignment) {
                    $this->entityManager->remove($assignment);
                }
        */
        $playerNationalityAssignments = $this->entityManager->getRepository(PlayerNationalityAssignment::class)->findBy(['player' => $player]);
        foreach ($playerNationalityAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    /**
     * Sendet eine Benachrichtigung an alle User, die über eine 'self_player'-Relation
     * mit dem Spieler verknüpft sind.
     */
    private function notifyPlayerUserRelations(Player $player, string $title, string $message): void
    {
        foreach ($player->getUserRelations() as $userRelation) {
            if (
                'player' === $userRelation->getRelationType()->getCategory()
                && 'self_player' === $userRelation->getRelationType()->getIdentifier()
            ) {
                $this->notificationService->createNotification(
                    $userRelation->getUser(),
                    'player_assignment',
                    $title,
                    $message
                );
            }
        }
    }
}
