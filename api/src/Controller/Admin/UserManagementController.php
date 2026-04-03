<?php

namespace App\Controller\Admin;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\Permission;
use App\Entity\Player;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\DefaultDashboardService;
use App\Service\NotificationService;
use DateTimeInterface;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use InvalidArgumentException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
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
                        ], $user->getUserRelations()->toArray())
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
            'user' => $user,
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

        // Beziehungstypen aus der Datenbank laden
        $relationTypes = $this->em->getRepository(RelationType::class)->findBy([], ['name' => 'ASC']);
        $permissions = $this->em->getRepository(Permission::class)->findBy([], ['name' => 'ASC']);

        // Bestehende Zuordnungen laden
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
            'currentAssignments' => $currentAssignments,
            'relationTypes' => $groupedRelationTypes,
            'permissions' => $permissions
        ]);
    }

    #[Route('/{id}/assign', name: 'assign_post', methods: ['POST'])]
    public function handleAssign(Request $request, User $user): Response
    {
        $this->em->beginTransaction();
        try {
            // Capture existing relation signatures to detect new ones later
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

            $data = json_decode($request->getContent(), true);
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
