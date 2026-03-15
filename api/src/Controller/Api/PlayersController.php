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
use DateTime;
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
        private CoachTeamPlayerService $coachTeamPlayerService
    ) {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 25)));
        $search = trim((string) $request->query->get('search', ''));
        $teamId = $request->query->get('teamId');

        $repo = $this->entityManager->getRepository(Player::class);
        $qb = $repo->createQueryBuilder('p');

        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $coachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($user));
        $isCoach = count($coachTeamIds) > 0;

        // Filter by team
        if ($teamId) {
            $qb->innerJoin('p.playerTeamAssignments', 'pta')
               ->andWhere('pta.team = :teamId')
               ->setParameter('teamId', (int) $teamId);
        } elseif (!$isAdmin && $isCoach) {
            // Coach sieht nur Spieler aus seinen aktiv zugeordneten Teams
            $qb->innerJoin('p.playerTeamAssignments', 'pta')
               ->andWhere('pta.team IN (:coachTeamIds)')
               ->setParameter('coachTeamIds', $coachTeamIds);
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
                        'id' => $assignment->getPlayerTeamAssignmentType()->getId(),
                        'name' => $assignment->getPlayerTeamAssignmentType()->getName()
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
        ]);
    }

    #[Route('/{id}', methods: ['GET'], name: 'show')]
    public function show(Player $player): JsonResponse
    {
        if (!$this->isGranted(PlayerVoter::VIEW, $player)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        return $this->json([
            'player' => [
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
                        'id' => $assignment->getPlayerTeamAssignmentType()->getId(),
                        'name' => $assignment->getPlayerTeamAssignmentType()->getName()
                    ]
                ], $player->getPlayerTeamAssignments()->toArray()),
                'fussballDeUrl' => $player->getFussballDeUrl(),
                'fussballDeId' => $player->getFussballDeId(),
                'permissions' => [
                    'canView' => $this->isGranted(PlayerVoter::VIEW, $player),
                    'canEdit' => $this->isGranted(PlayerVoter::EDIT, $player),
                    'canCreate' => $this->isGranted(PlayerVoter::CREATE, $player),
                    'canDelete' => $this->isGranted(PlayerVoter::DELETE, $player)
                ]
            ]
        ]);
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
            $player->setMainPosition($mainPosition);
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

        $player->setFirstName($data['firstName']);
        $player->setLastName($data['lastName']);
        $player->setEmail($data['email'] ?? '');
        $player->setBirthdate(isset($data['birthdate']) ? new DateTime($data['birthdate']) : null);

        if (isset($data['mainPosition']['id'])) {
            $mainPosition = $this->entityManager->getRepository(Position::class)->find($data['mainPosition']['id']);
            $player->setMainPosition($mainPosition);
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
        /*
                foreach (($data['licenseAssignments'] ?? []) as $licenseAssignment) {
                    if (isset($licenseAssignment['id'])
                        && isset($licenseAssignment['license'])
                        && in_array($licenseAssignment['id'], $existingPlayerLicenseAssignments)
                    ) {
                        $existingPlayerLicenseAssignments = array_filter($existingPlayerLicenseAssignments, fn($id) => $id !== $licenseAssignment['id']);
                    }
                    if (isset($licenseAssignment['id'])) {
                        $playerLicenseAssignment = $this->entityManager->getRepository(PlayerLicenseAssignment::class)->find((int) $licenseAssignment['id']);
                    } else {
                        $playerLicenseAssignment = new PlayerLicenseAssignment();
                    }

                    $license = $this->entityManager->getRepository(PlayerLicense::class)->find($licenseAssignment['license']['id']);
                    $playerLicenseAssignment->setPlayer($player);
                    $playerLicenseAssignment->setStartDate(isset($licenseAssignment['startDate']) ? new DateTime($licenseAssignment['startDate']) : null);
                    $playerLicenseAssignment->setEndDate(isset($licenseAssignment['endDate']) ? new DateTime($licenseAssignment['endDate']) : null);
                    $playerLicenseAssignment->setLicense($license);

                    $this->entityManager->persist($playerLicenseAssignment);
                }

                $this->entityManager->getRepository(PlayerLicenseAssignment::class)->deleteByIds($existingPlayerLicenseAssignments);
        */
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

        foreach (($data['teamAssignments'] ?? []) as $teamAssignment) {
            if (
                isset($teamAssignment['id'])
                && isset($teamAssignment['team'])
                && in_array($teamAssignment['id'], $existingPlayerTeams)
            ) {
                $existingPlayerTeams = array_filter($existingPlayerTeams, fn ($id) => $id !== $teamAssignment['id']);
            }

            $team = $this->entityManager->getRepository(Team::class)->find($teamAssignment['team']['id']);
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

        /** @var PlayerTeamAssignmentRepository $playerTeamAssignmentRepository */
        $playerTeamAssignmentRepository = $this->entityManager->getRepository(PlayerTeamAssignment::class);
        $playerTeamAssignmentRepository->deleteByIds($existingPlayerTeams);

        $this->entityManager->persist($player);
        $this->entityManager->flush();

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
}
