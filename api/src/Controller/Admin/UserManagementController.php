<?php

namespace App\Controller\Admin;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryClubAssignmentType;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\Permission;
use App\Entity\Player;
use App\Entity\RelationType;
use App\Entity\StaffClubAssignment;
use App\Entity\StaffClubAssignmentType;
use App\Entity\StaffTeamAssignment;
use App\Entity\StaffTeamAssignmentType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\DefaultDashboardService;
use App\Service\NotificationService;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use InvalidArgumentException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/admin/users', name: 'admin_users_')]
#[IsGranted('ROLE_ADMIN')]
class UserManagementController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private NotificationService $notificationService,
        private DefaultDashboardService $defaultDashboardService,
    ) {
    }

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query->get('search', ''));

        if ('' !== $search) {
            $qb = $this->em->getRepository(User::class)->createQueryBuilder('u')
                ->where('u.firstName LIKE :term OR u.lastName LIKE :term OR u.email LIKE :term')
                ->setParameter('term', '%' . $search . '%')
                ->orderBy('u.lastName', 'ASC')
                ->addOrderBy('u.firstName', 'ASC');
            $users = $qb->getQuery()->getResult();
        } else {
            $users = $this->em->getRepository(User::class)->findBy([], ['lastName' => 'ASC', 'firstName' => 'ASC']);
        }

        return $this->json(
            [
                'users' => array_map(
                    fn (User $user) => [
                        'id' => $user->getId(),
                        'fullName' => $user->getFullName(),
                        'email' => $user->getEmail(),
                        'roles' => $user->getRoles(),
                        'isVerified' => $user->isVerified(),
                        'isEnabled' => $user->isEnabled(),
                        'lockedAt' => $user->getLockedAt()?->format(DateTimeInterface::ATOM),
                        'userRelations' => array_map(fn (UserRelation $relation) => [
                            'id' => $relation->getId(),
                            'type' => $relation->getRelationType()->getName(),
                            'entity' => $relation->getPlayer() ? $relation->getPlayer()->getFullName() : ($relation->getCoach() ? $relation->getCoach()->getFullName() : null),
                            'permissions' => $relation->getPermissions(),
                            'relationType' => [
                                'id' => $relation->getRelationType()->getId(),
                                'name' => $relation->getRelationType()->getName(),
                                'identifier' => $relation->getRelationType()->getIdentifier(),
                                'category' => $relation->getRelationType()->getCategory()
                            ]
                        ], $user->getUserRelations()->toArray()),
                        'staffTeamAssignments' => array_map(fn (StaffTeamAssignment $a) => [
                            'id' => $a->getId(),
                            'team' => ['id' => $a->getTeam()?->getId(), 'name' => $a->getTeam()?->getName()],
                            'type' => $a->getStaffTeamAssignmentType() ? ['id' => $a->getStaffTeamAssignmentType()->getId(), 'name' => $a->getStaffTeamAssignmentType()->getName()] : null,
                            'startDate' => $a->getStartDate()?->format('Y-m-d'),
                            'endDate' => $a->getEndDate()?->format('Y-m-d'),
                        ], $this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user])),
                        'staffClubAssignments' => array_map(fn (StaffClubAssignment $a) => [
                            'id' => $a->getId(),
                            'club' => ['id' => $a->getClub()?->getId(), 'name' => $a->getClub()?->getName()],
                            'type' => $a->getStaffClubAssignmentType() ? ['id' => $a->getStaffClubAssignmentType()->getId(), 'name' => $a->getStaffClubAssignmentType()->getName()] : null,
                            'startDate' => $a->getStartDate()?->format('Y-m-d'),
                            'endDate' => $a->getEndDate()?->format('Y-m-d'),
                        ], $this->em->getRepository(StaffClubAssignment::class)->findBy(['user' => $user])),
                        'functionaryTeamAssignments' => array_map(fn (FunctionaryTeamAssignment $a) => [
                            'id' => $a->getId(),
                            'team' => ['id' => $a->getTeam()?->getId(), 'name' => $a->getTeam()?->getName()],
                            'type' => $a->getFunctionaryTeamAssignmentType() ? ['id' => $a->getFunctionaryTeamAssignmentType()->getId(), 'name' => $a->getFunctionaryTeamAssignmentType()->getName()] : null,
                            'startDate' => $a->getStartDate()?->format('Y-m-d'),
                            'endDate' => $a->getEndDate()?->format('Y-m-d'),
                        ], $this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user])),
                        'functionaryClubAssignments' => array_map(fn (FunctionaryClubAssignment $a) => [
                            'id' => $a->getId(),
                            'club' => ['id' => $a->getClub()?->getId(), 'name' => $a->getClub()?->getName()],
                            'type' => $a->getFunctionaryClubAssignmentType() ? ['id' => $a->getFunctionaryClubAssignmentType()->getId(), 'name' => $a->getFunctionaryClubAssignmentType()->getName()] : null,
                            'startDate' => $a->getStartDate()?->format('Y-m-d'),
                            'endDate' => $a->getEndDate()?->format('Y-m-d'),
                        ], $this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]))
                    ],
                    $users
                )
            ]
        );
    }

    #[Route('/{id}/roles', name: 'edit_roles', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    public function editRoles(User $user): JsonResponse
    {
        // Verfügbare Rollen definieren
        $availableRoles = [
            'ROLE_GUEST' => 'Guest',
            'ROLE_USER' => 'Benutzer',
            'ROLE_SUPPORTER' => 'Supporter',
            'ROLE_ADMIN' => 'Administrator',
            'ROLE_SUPERADMIN' => 'Super Administrator'
        ];

        return $this->json([
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
                'firstName' => $user->getFirstName(),
                'lastName' => $user->getLastName(),
            ],
            'available_roles' => $availableRoles,
            'current_roles' => $user->getRoles()
        ]);
    }

    #[Route('/{id}/roles', name: 'update_roles', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    public function updateRoles(Request $request, User $user): JsonResponse
    {
        $currentUser = $this->getUser();
        $jsonContent = json_decode($request->getContent(), true);
        $selectedRoles = $jsonContent['roles'] ?? [];

        // Sicherstellen dass ROLE_USER immer gesetzt ist
        if (!in_array('ROLE_USER', $selectedRoles)) {
            $selectedRoles[] = 'ROLE_USER';
        }

        $answer = ['id' => $user->getId()];

        try {
            $user->setRoles($selectedRoles);
            $this->em->flush();
            $answer = ['success' => true, 'message' => 'Benutzerrollen wurden erfolgreich aktualisiert.'];
        } catch (Exception $e) {
            $answer = ['error' => 'Fehler beim Aktualisieren der Rollen: ' . $e->getMessage()];
        }

        return $this->json($answer);
    }

    #[Route('/{id}/assign', name: 'assign', methods: ['GET'])]
    public function assignForm(User $user): JsonResponse
    {
        $players = $this->em->getRepository(Player::class)->findAll();
        $coaches = $this->em->getRepository(Coach::class)->findAll();
        $teams = $this->em->getRepository(Team::class)->findBy([], ['name' => 'ASC']);
        $clubs = $this->em->getRepository(Club::class)->findBy([], ['name' => 'ASC']);

        // Beziehungstypen aus der Datenbank laden
        $relationTypes = $this->em->getRepository(RelationType::class)->findBy([], ['name' => 'ASC']);
        $permissions = $this->em->getRepository(Permission::class)->findBy([], ['name' => 'ASC']);

        // Assignment-Typen laden
        $staffTeamTypes = $this->em->getRepository(StaffTeamAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);
        $staffClubTypes = $this->em->getRepository(StaffClubAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);
        $functionaryTeamTypes = $this->em->getRepository(FunctionaryTeamAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);
        $functionaryClubTypes = $this->em->getRepository(FunctionaryClubAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC']);

        // Bestehende Spieler-/Trainer-Zuordnungen laden
        $userRelations = $this->em->getRepository(UserRelation::class)->findBy(['user' => $user]);
        $currentAssignments = ['players' => [], 'coaches' => []];
        $entity = null;

        foreach ($userRelations as $relation) {
            $type = null;
            if ($relation->getPlayer()) {
                $type = 'players';
                $entity = $relation->getPlayer();
            } elseif ($relation->getCoach()) {
                $type = 'coaches';
                $entity = $relation->getCoach();
            }

            if (
                $entity instanceof Player
                || $entity instanceof Coach
            ) {
                $currentAssignments[$type][] = [
                    'entity' => [
                        'id' => $entity->getId(),
                        'fullName' => $entity->getFullName(),
                        'email' => $entity->getEmail()
                    ],
                    'relationType' => $relation->getRelationType(),
                    'permissions' => $relation->getPermissions()
                ];
            }
        }

        // RelationTypes nach Kategorie gruppieren
        $groupedRelationTypes = [];
        foreach ($relationTypes as $type) {
            $groupedRelationTypes[$type->getCategory()][] = $type;
        }

        // Bestehende Staff-/Funktionärs-Zuordnungen laden
        $staffTeamAssignments = $this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user]);
        $staffClubAssignments = $this->em->getRepository(StaffClubAssignment::class)->findBy(['user' => $user]);
        $functionaryTeamAssignments = $this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]);
        $functionaryClubAssignments = $this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]);

        return $this->json([
            'user' => [
                'id' => $user->getId(),
                'fullName' => $user->getFullName(),
                'email' => $user->getEmail(),
                'roles' => $user->getRoles(),
                'isVerified' => $user->isVerified(),
                'isEnabled' => $user->isEnabled(),
                'userRelations' => array_map(fn (UserRelation $relation) => [
                    'id' => $relation->getId(),
                    'type' => $relation->getRelationType()->getName(),
                    'entity' => $relation->getPlayer() ? $relation->getPlayer()->getFullName() : ($relation->getCoach() ? $relation->getCoach()->getFullName() : null),
                    'permissions' => $relation->getPermissions(),
                    'relationType' => [
                        'id' => $relation->getRelationType()->getId(),
                        'name' => $relation->getRelationType()->getName(),
                        'identifier' => $relation->getRelationType()->getIdentifier(),
                        'category' => $relation->getRelationType()->getCategory()
                    ]
                ], $user->getUserRelations()->toArray())
            ],
            'players' => array_map(fn (Player $player) => [
                'id' => $player->getId(),
                'fullName' => $player->getFullName(),
                'email' => $player->getEmail(),
                'teams' => array_values(array_unique(array_map(
                    fn ($pta) => $pta->getTeam()->getName(),
                    $player->getPlayerTeamAssignments()->toArray()
                ))),
            ], $players),
            'coaches' => array_map(fn (Coach $coach) => [
                'id' => $coach->getId(),
                'fullName' => $coach->getFullName(),
                'email' => $coach->getEmail(),
                'teams' => array_values(array_unique(array_map(
                    fn ($cta) => $cta->getTeam()->getName(),
                    $coach->getCoachTeamAssignments()->toArray()
                ))),
            ], $coaches),
            'teams' => array_map(fn (Team $t) => ['id' => $t->getId(), 'name' => $t->getName()], $teams),
            'clubs' => array_map(fn (Club $c) => ['id' => $c->getId(), 'name' => $c->getName()], $clubs),
            'staffTeamAssignmentTypes' => array_map(fn (StaffTeamAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()], $staffTeamTypes),
            'staffClubAssignmentTypes' => array_map(fn (StaffClubAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()], $staffClubTypes),
            'functionaryTeamAssignmentTypes' => array_map(fn (FunctionaryTeamAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()], $functionaryTeamTypes),
            'functionaryClubAssignmentTypes' => array_map(fn (FunctionaryClubAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()], $functionaryClubTypes),
            'currentAssignments' => $currentAssignments,
            'currentStaffTeamAssignments' => array_map(fn (StaffTeamAssignment $a) => [
                'teamId' => $a->getTeam()?->getId(),
                'teamName' => $a->getTeam()?->getName(),
                'typeId' => $a->getStaffTeamAssignmentType()?->getId(),
                'typeName' => $a->getStaffTeamAssignmentType()?->getName(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $staffTeamAssignments),
            'currentStaffClubAssignments' => array_map(fn (StaffClubAssignment $a) => [
                'clubId' => $a->getClub()?->getId(),
                'clubName' => $a->getClub()?->getName(),
                'typeId' => $a->getStaffClubAssignmentType()?->getId(),
                'typeName' => $a->getStaffClubAssignmentType()?->getName(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $staffClubAssignments),
            'currentFunctionaryTeamAssignments' => array_map(fn (FunctionaryTeamAssignment $a) => [
                'teamId' => $a->getTeam()?->getId(),
                'teamName' => $a->getTeam()?->getName(),
                'typeId' => $a->getFunctionaryTeamAssignmentType()?->getId(),
                'typeName' => $a->getFunctionaryTeamAssignmentType()?->getName(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $functionaryTeamAssignments),
            'currentFunctionaryClubAssignments' => array_map(fn (FunctionaryClubAssignment $a) => [
                'clubId' => $a->getClub()?->getId(),
                'clubName' => $a->getClub()?->getName(),
                'typeId' => $a->getFunctionaryClubAssignmentType()?->getId(),
                'typeName' => $a->getFunctionaryClubAssignmentType()?->getName(),
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $functionaryClubAssignments),
            'relationTypes' => $groupedRelationTypes,
            'permissions' => $permissions
        ]);
    }

    #[Route('/{id}/assign', name: 'assign_post', methods: ['POST'])]
    public function handleAssign(Request $request, User $user): Response
    {
        $this->em->beginTransaction();
        try {
            $data = json_decode($request->getContent(), true);

            // ── Spieler-/Trainer-Zuordnungen ────────────────────────────────
            $existingRelations = $this->em->getRepository(UserRelation::class)->findBy(['user' => $user]);
            $oldSignatures = [];
            foreach ($existingRelations as $existingRelation) {
                $pid = $existingRelation->getPlayer()?->getId();
                $cid = $existingRelation->getCoach()?->getId();
                $rtid = $existingRelation->getRelationType()->getId();
                $oldSignatures[] = $rtid . '_' . ($pid ?? 'c' . $cid);
                $this->em->remove($existingRelation);
            }
            $newRelations = [];

            $relations = $data['relations'] ?? [];

            foreach ($relations as $index => $assignment) {
                if (empty($assignment['relationType']['id']) || empty($assignment['entity']['id'])) {
                    throw new InvalidArgumentException("Ungültige Daten für Zuordnung #{$index}");
                }

                $relationType = $this->em->getRepository(RelationType::class)->find($assignment['relationType']['id']);
                if (!$relationType) {
                    throw new InvalidArgumentException("Beziehungstyp mit ID {$assignment['relationType']['id']} nicht gefunden");
                }

                $category = $relationType->getCategory();
                $relation = new UserRelation();
                $relation->setUser($user);
                $relation->setRelationType($relationType);
                $relation->setPermissions($assignment['permissions'] ?? []);

                if ('player' === $category) {
                    $player = $this->em->getRepository(Player::class)->find($assignment['entity']['id']);
                    if (!$player) {
                        throw new InvalidArgumentException("Spieler mit ID {$assignment['entity']['id']} nicht gefunden");
                    }
                    $relation->setPlayer($player);
                } elseif ('coach' === $category) {
                    $coach = $this->em->getRepository(Coach::class)->find($assignment['entity']['id']);
                    if (!$coach) {
                        throw new InvalidArgumentException("Trainer mit ID {$assignment['entity']['id']} nicht gefunden");
                    }
                    $relation->setCoach($coach);
                } else {
                    throw new InvalidArgumentException("Unbekannte Kategorie: {$category}");
                }

                $this->em->persist($relation);
                $newRelations[] = $relation;
            }

            // ── Staff-Team-Zuordnungen ────────────────────────────────────────
            foreach ($this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user]) as $a) {
                $this->em->remove($a);
            }
            foreach ($data['staffTeamAssignments'] ?? [] as $item) {
                if (empty($item['teamId'])) {
                    continue;
                }
                $a = new StaffTeamAssignment();
                $a->setUser($user);
                $a->setTeam($this->em->getRepository(Team::class)->find($item['teamId']));
                if (!empty($item['typeId'])) {
                    $a->setStaffTeamAssignmentType($this->em->getRepository(StaffTeamAssignmentType::class)->find($item['typeId']));
                }
                if (!empty($item['startDate'])) {
                    $a->setStartDate(new DateTimeImmutable($item['startDate']));
                }
                if (!empty($item['endDate'])) {
                    $a->setEndDate(new DateTimeImmutable($item['endDate']));
                }
                $this->em->persist($a);
            }

            // ── Staff-Club-Zuordnungen ────────────────────────────────────────
            foreach ($this->em->getRepository(StaffClubAssignment::class)->findBy(['user' => $user]) as $a) {
                $this->em->remove($a);
            }
            foreach ($data['staffClubAssignments'] ?? [] as $item) {
                if (empty($item['clubId'])) {
                    continue;
                }
                $a = new StaffClubAssignment();
                $a->setUser($user);
                $a->setClub($this->em->getRepository(Club::class)->find($item['clubId']));
                if (!empty($item['typeId'])) {
                    $a->setStaffClubAssignmentType($this->em->getRepository(StaffClubAssignmentType::class)->find($item['typeId']));
                }
                if (!empty($item['startDate'])) {
                    $a->setStartDate(new DateTimeImmutable($item['startDate']));
                }
                if (!empty($item['endDate'])) {
                    $a->setEndDate(new DateTimeImmutable($item['endDate']));
                }
                $this->em->persist($a);
            }

            // ── Funktionär-Team-Zuordnungen ───────────────────────────────────
            foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]) as $a) {
                $this->em->remove($a);
            }
            foreach ($data['functionaryTeamAssignments'] ?? [] as $item) {
                if (empty($item['teamId'])) {
                    continue;
                }
                $a = new FunctionaryTeamAssignment();
                $a->setUser($user);
                $a->setTeam($this->em->getRepository(Team::class)->find($item['teamId']));
                if (!empty($item['typeId'])) {
                    $a->setFunctionaryTeamAssignmentType($this->em->getRepository(FunctionaryTeamAssignmentType::class)->find($item['typeId']));
                }
                if (!empty($item['startDate'])) {
                    $a->setStartDate(new DateTimeImmutable($item['startDate']));
                }
                if (!empty($item['endDate'])) {
                    $a->setEndDate(new DateTimeImmutable($item['endDate']));
                }
                $this->em->persist($a);
            }

            // ── Funktionär-Club-Zuordnungen ───────────────────────────────────
            foreach ($this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]) as $a) {
                $this->em->remove($a);
            }
            foreach ($data['functionaryClubAssignments'] ?? [] as $item) {
                if (empty($item['clubId'])) {
                    continue;
                }
                $a = new FunctionaryClubAssignment();
                $a->setUser($user);
                $a->setClub($this->em->getRepository(Club::class)->find($item['clubId']));
                if (!empty($item['typeId'])) {
                    $a->setFunctionaryClubAssignmentType($this->em->getRepository(FunctionaryClubAssignmentType::class)->find($item['typeId']));
                }
                if (!empty($item['startDate'])) {
                    $a->setStartDate(new DateTimeImmutable($item['startDate']));
                }
                if (!empty($item['endDate'])) {
                    $a->setEndDate(new DateTimeImmutable($item['endDate']));
                }
                $this->em->persist($a);
            }

            $this->em->flush();
            $this->em->commit();

            // Ensure team-specific report widgets exist for newly linked teams
            try {
                $this->defaultDashboardService->createDefaultDashboard($user);
            } catch (Throwable) {
                // Non-critical – don't roll back the assignment
            }

            // Send push notification to the user for each genuinely new relation
            foreach ($newRelations as $newRelation) {
                $pid = $newRelation->getPlayer()?->getId();
                $cid = $newRelation->getCoach()?->getId();
                $rtid = $newRelation->getRelationType()->getId();
                $sig = $rtid . '_' . ($pid ?? 'c' . $cid);

                if (in_array($sig, $oldSignatures, true)) {
                    continue; // unchanged relation – skip notification
                }

                $relTypeName = $newRelation->getRelationType()->getName();

                if ($newRelation->getPlayer()) {
                    $entityLabel = 'Spieler';
                    $entityName = $newRelation->getPlayer()->getFullName();
                } else {
                    $entityLabel = 'Trainer';
                    $entityName = $newRelation->getCoach()?->getFullName() ?? 'unbekannt';
                }

                try {
                    $this->notificationService->createNotification(
                        $user,
                        'user_relation_assigned',
                        'Neue Verknüpfung eingerichtet',
                        sprintf(
                            'Du wurdest als %s mit dem %s %s verknüpft.',
                            $relTypeName,
                            $entityLabel,
                            $entityName
                        ),
                        ['url' => '/profile']
                    );
                } catch (Throwable) {
                    // Non-critical – don't roll back
                }
            }

            return $this->json([
                'status' => 'success',
                'message' => 'Zuordnungen erfolgreich aktualisiert.'
            ]);
        } catch (Exception $e) {
            $this->em->rollback();

            return $this->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    #[Route('/{id}/toggle-status', name: 'toggle_status', methods: ['GET'])]
    public function toggleStatus(User $user): Response
    {
        $user->setIsEnabled(!$user->isEnabled());
        $this->em->flush();

        return $this->json(['success' => true, 'message' => sprintf(
            'Benutzer %s wurde erfolgreich %s.',
            $user->getEmail(),
            $user->isEnabled() ? 'aktiviert' : 'deaktiviert'
        )]);
    }

    #[Route('/{id}/unlock', name: 'unlock', methods: ['POST'])]
    public function unlock(User $user): Response
    {
        if (!$user->isLocked()) {
            return $this->json(['success' => false, 'message' => 'Konto ist nicht gesperrt.'], 400);
        }

        $user->setLockedAt(null);
        $user->setLockReason(null);
        $user->setAccountUnlockToken(null);
        $user->setAccountUnlockTokenExpiresAt(null);
        $this->em->flush();

        return $this->json([
            'success' => true,
            'message' => sprintf('Konto von %s wurde entsperrt.', $user->getEmail()),
        ]);
    }

    #[Route('/search/{type}', name: 'search', methods: ['GET'])]
    public function search(string $type, Request $request): JsonResponse
    {
        $term = $request->query->get('term');
        if (empty($term)) {
            return $this->json([]);
        }

        $qb = match ($type) {
            'player' => $this->em->getRepository(Player::class)->createQueryBuilder('p')
                ->where('p.firstName LIKE :term OR p.lastName LIKE :term OR p.email LIKE :term')
                ->setParameter('term', '%' . $term . '%')
                ->orderBy('p.lastName', 'ASC')
                ->setMaxResults(10),

            'coach' => $this->em->getRepository(Coach::class)->createQueryBuilder('c')
                ->where('c.firstName LIKE :term OR c.lastName LIKE :term OR c.email LIKE :term')
                ->setParameter('term', '%' . $term . '%')
                ->orderBy('c.lastName', 'ASC')
                ->setMaxResults(10),

            'club' => $this->em->getRepository(Club::class)->createQueryBuilder('c')
                ->where('c.name LIKE :term')
                ->setParameter('term', '%' . $term . '%')
                ->orderBy('c.name', 'ASC')
                ->setMaxResults(10),

            default => throw $this->createNotFoundException('Invalid search type'),
        };

        $results = $qb->getQuery()->getResult();

        $formatted = array_map(function ($item) use ($type) {
            return [
                'id' => $item->getId(),
                'text' => match ($type) {
                    'player', 'coach' => $item->getFullName() . ($item->getEmail() ? ' (' . $item->getEmail() . ')' : ''),
                    'club' => $item->getName(),
                    default => ''
                },
            ];
        }, $results);

        return $this->json(['results' => $formatted]);
    }

    #[Route('/{id}', name: 'user_delete', methods: ['DELETE'])]
    public function deleteUser(User $user): Response
    {
        try {
            /** @var Connection $conn */
            $conn = $this->em->getConnection();
            $id = $user->getId();

            // ── 1. Nullify nullable audit / substitute references ──────────────────
            $conn->executeStatement('UPDATE videos            SET updated_from_id   = NULL WHERE updated_from_id   = ?', [$id]);
            $conn->executeStatement('UPDATE camera            SET updated_from_id   = NULL WHERE updated_from_id   = ?', [$id]);
            $conn->executeStatement('UPDATE task_assignments  SET substitute_user_id = NULL WHERE substitute_user_id = ?', [$id]);

            // ── 2. Remove dependent child rows before deleting parent rows ─────────
            // task_assignments that belong to tasks being deleted
            $conn->executeStatement(
                'DELETE ta FROM task_assignments ta INNER JOIN tasks t ON ta.task_id = t.id WHERE t.created_by_id = ?',
                [$id]
            );
            // team_ride_passengers for rides where this user was the driver
            $conn->executeStatement(
                'DELETE trp FROM team_ride_passenger trp INNER JOIN team_ride tr ON trp.team_ride_id = tr.id WHERE tr.driver_id = ?',
                [$id]
            );
            // video_segments for videos being deleted
            $conn->executeStatement(
                'DELETE vs FROM video_segments vs INNER JOIN videos v ON vs.video_id = v.id WHERE v.created_from_id = ?',
                [$id]
            );

            // ── 3. Delete records owned by or requiring this user ──────────────────
            $conn->executeStatement('DELETE FROM dashboard_widgets  WHERE user_id        = ?', [$id]);
            $conn->executeStatement('DELETE FROM user_relations      WHERE user_id        = ?', [$id]);
            $conn->executeStatement('DELETE FROM team_ride_passenger WHERE user_id        = ?', [$id]);
            $conn->executeStatement('DELETE FROM team_ride           WHERE driver_id      = ?', [$id]);
            $conn->executeStatement('DELETE FROM task_assignments    WHERE user_id        = ?', [$id]);
            $conn->executeStatement('DELETE FROM tasks               WHERE created_by_id  = ?', [$id]);
            $conn->executeStatement('DELETE FROM news                WHERE created_by     = ?', [$id]);
            $conn->executeStatement('DELETE FROM videos              WHERE created_from_id = ?', [$id]);
            $conn->executeStatement(
                'DELETE FROM video_types WHERE created_from_id = ? OR updated_from_id = ?',
                [$id, $id]
            );
            $conn->executeStatement('DELETE FROM camera WHERE created_from_id = ?', [$id]);

            // ── 4. Let Doctrine cascade the rest (user_levels, user_xp_events,
            //       push_subscriptions, video_segments via orphanRemoval / cascade)
            $this->em->refresh($user);
            $this->em->remove($user);
            $this->em->flush();

            return $this->json(['success' => true, 'message' => 'Benutzer erfolgreich gelöscht.']);
        } catch (Exception $e) {
            return $this->json(['error' => 'Fehler beim Löschen des Benutzers: ' . $e->getMessage()], 400);
        }
    }
}
