<?php

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\PenaltyType;
use App\Entity\TabEntry;
use App\Entity\Team;
use App\Entity\User;
use App\Service\TeamMembershipService;
use App\Service\UserTeamAccessService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/penalty', name: 'api_penalty_')]
#[IsGranted('ROLE_USER')]
class PenaltyController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserTeamAccessService $teamAccessService,
        private TeamMembershipService $teamMembershipService,
    ) {
    }

    private function isKassenwart(User $user): bool
    {
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }

        /** @var FunctionaryTeamAssignment[] $teamAssignments */
        $teamAssignments = $this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]);
        foreach ($teamAssignments as $a) {
            if ('Kassenwart' === $a->getFunctionaryTeamAssignmentType()?->getName()) {
                return true;
            }
        }

        /** @var FunctionaryClubAssignment[] $clubAssignments */
        $clubAssignments = $this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]);
        foreach ($clubAssignments as $a) {
            if ('Kassenwart' === $a->getFunctionaryClubAssignmentType()?->getName()) {
                return true;
            }
        }

        return false;
    }

    private function isCoach(User $user): bool
    {
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            return true;
        }

        return !empty($this->teamAccessService->getSelfCoachTeams($user));
    }

    /** @return array<int, Team> */
    private function getCoachTeams(User $user): array
    {
        if ($this->isGranted('ROLE_SUPERADMIN')) {
            $all = $this->em->getRepository(Team::class)->findAll();
            $result = [];
            foreach ($all as $t) {
                $result[$t->getId()] = $t;
            }

            return $result;
        }

        return $this->teamAccessService->getSelfCoachTeams($user);
    }

    /** @return array<string, mixed> */
    private function serializePenaltyType(PenaltyType $pt): array
    {
        return [
            'id' => $pt->getId(),
            'name' => $pt->getName(),
            'description' => $pt->getDescription(),
            'amount' => $pt->getAmount(),
            'isPositive' => $pt->isPositive(),
            'active' => $pt->isActive(),
            'validFrom' => $pt->getValidFrom()?->format('Y-m-d'),
            'validUntil' => $pt->getValidUntil()?->format('Y-m-d'),
            'isGlobal' => $pt->isGlobal(),
            'teamId' => $pt->getTeam()?->getId(),
            'teamName' => $pt->getTeam()?->getName(),
            'clubId' => $pt->getClub()?->getId(),
            'clubName' => $pt->getClub()?->getName(),
        ];
    }

    #[Route('/catalog', name: 'catalog_list', methods: ['GET'])]
    public function catalogList(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user) && !$this->isCoach($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $all = $this->em->getRepository(PenaltyType::class)->findBy([], ['name' => 'ASC']);

        $coachTeams = $this->getCoachTeams($user);
        $coachTeamIds = array_keys($coachTeams);

        $teams = !empty($coachTeamIds)
            ? $this->em->getRepository(Team::class)->findBy(['id' => $coachTeamIds])
            : [];
        $clubs = $this->em->getRepository(Club::class)->findAll();

        $filtered = [];
        foreach ($all as $pt) {
            if ($this->isGranted('ROLE_SUPERADMIN')) {
                $filtered[] = $this->serializePenaltyType($pt);
                continue;
            }
            if ($pt->isGlobal()) {
                $filtered[] = $this->serializePenaltyType($pt);
                continue;
            }
            if (null !== $pt->getTeam() && \in_array($pt->getTeam()->getId(), $coachTeamIds, true)) {
                $filtered[] = $this->serializePenaltyType($pt);
                continue;
            }
            if (null !== $pt->getClub()) {
                $filtered[] = $this->serializePenaltyType($pt);
            }
        }

        return $this->json([
            'catalog' => $filtered,
            'teams' => array_map(static fn (Team $t) => ['id' => $t->getId(), 'name' => $t->getName()], $teams),
            'clubs' => array_map(static fn (Club $c) => ['id' => $c->getId(), 'name' => $c->getName()], $clubs),
        ]);
    }

    #[Route('/catalog', name: 'catalog_create', methods: ['POST'])]
    public function catalogCreate(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user) && !$this->isCoach($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        $name = trim($data['name'] ?? '');
        $amount = (float) ($data['amount'] ?? 0);

        if ('' === $name || $amount <= 0) {
            return $this->json(['error' => 'Name und Betrag (> 0) sind erforderlich.'], Response::HTTP_BAD_REQUEST);
        }

        $pt = new PenaltyType();
        $pt->setName($name);
        $pt->setAmount($amount);
        $pt->setPositive((bool) ($data['isPositive'] ?? false));
        $pt->setDescription($data['description'] ?? null);
        $pt->setActive((bool) ($data['active'] ?? true));

        if (!empty($data['validFrom'])) {
            $pt->setValidFrom(new DateTimeImmutable($data['validFrom']));
        }
        if (!empty($data['validUntil'])) {
            $pt->setValidUntil(new DateTimeImmutable($data['validUntil']));
        }
        if (!empty($data['teamId'])) {
            $team = $this->em->getRepository(Team::class)->find($data['teamId']);
            if ($team) {
                $pt->setTeam($team);
            }
        }
        if (!empty($data['clubId'])) {
            $club = $this->em->getRepository(Club::class)->find($data['clubId']);
            if ($club) {
                $pt->setClub($club);
            }
        }

        $this->em->persist($pt);
        $this->em->flush();

        return $this->json($this->serializePenaltyType($pt), Response::HTTP_CREATED);
    }

    #[Route('/catalog/{id}', name: 'catalog_update', methods: ['PUT'])]
    public function catalogUpdate(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user) && !$this->isCoach($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $pt = $this->em->getRepository(PenaltyType::class)->find($id);
        if (!$pt) {
            return $this->json(['error' => 'Strafentyp nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if ($pt->isGlobal() && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['error' => 'Globale Strafentypen können nur vom Admin bearbeitet werden.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        if (isset($data['name'])) {
            $pt->setName(trim($data['name']));
        }
        if (isset($data['amount'])) {
            $pt->setAmount((float) $data['amount']);
        }
        if (isset($data['isPositive'])) {
            $pt->setPositive((bool) $data['isPositive']);
        }
        if (\array_key_exists('description', $data)) {
            $pt->setDescription($data['description']);
        }
        if (isset($data['active'])) {
            $pt->setActive((bool) $data['active']);
        }
        if (\array_key_exists('validFrom', $data)) {
            $pt->setValidFrom(!empty($data['validFrom']) ? new DateTimeImmutable($data['validFrom']) : null);
        }
        if (\array_key_exists('validUntil', $data)) {
            $pt->setValidUntil(!empty($data['validUntil']) ? new DateTimeImmutable($data['validUntil']) : null);
        }

        $this->em->flush();

        return $this->json($this->serializePenaltyType($pt));
    }

    #[Route('/catalog/{id}', name: 'catalog_delete', methods: ['DELETE'])]
    public function catalogDelete(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user) && !$this->isCoach($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $pt = $this->em->getRepository(PenaltyType::class)->find($id);
        if (!$pt) {
            return $this->json(['error' => 'Strafentyp nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if ($pt->isGlobal() && !$this->isGranted('ROLE_SUPERADMIN')) {
            return $this->json(['error' => 'Globale Strafentypen können nur vom Admin gelöscht werden.'], Response::HTTP_FORBIDDEN);
        }

        $usageCount = $this->em->getRepository(TabEntry::class)->count(['penaltyType' => $pt]);
        if ($usageCount > 0) {
            return $this->json([
                'error' => "Dieser Strafentyp wird von {$usageCount} Einträgen verwendet und kann nicht gelöscht werden.",
            ], Response::HTTP_CONFLICT);
        }

        $this->em->remove($pt);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/assign', name: 'assign', methods: ['POST'])]
    public function assign(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        $penaltyTypeId = (int) ($data['penaltyTypeId'] ?? 0);
        $targetUserId = (int) ($data['userId'] ?? 0);
        $teamId = (int) ($data['teamId'] ?? 0);

        if (0 === $penaltyTypeId || 0 === $targetUserId || 0 === $teamId) {
            return $this->json(['error' => 'penaltyTypeId, userId und teamId sind erforderlich.'], Response::HTTP_BAD_REQUEST);
        }

        $pt = $this->em->getRepository(PenaltyType::class)->find($penaltyTypeId);
        if (!$pt || !$pt->isActive()) {
            return $this->json(['error' => 'Strafentyp nicht gefunden oder inaktiv.'], Response::HTTP_BAD_REQUEST);
        }

        if (!$pt->isCurrentlyValid()) {
            return $this->json(['error' => 'Strafentyp ist aktuell nicht gültig.'], Response::HTTP_BAD_REQUEST);
        }

        $team = $this->em->getRepository(Team::class)->find($teamId);
        if (!$team) {
            return $this->json(['error' => 'Team nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $coachTeams = $this->getCoachTeams($user);
        if (!isset($coachTeams[$team->getId()])) {
            return $this->json(['error' => 'Du bist kein Trainer dieses Teams.'], Response::HTTP_FORBIDDEN);
        }

        $targetUser = $this->em->getRepository(User::class)->find($targetUserId);
        if (!$targetUser) {
            return $this->json(['error' => 'Benutzer nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $teamMembers = $this->teamMembershipService->resolveTeamMembers($team);
        if (!isset($teamMembers[$targetUser->getId()])) {
            return $this->json(['error' => 'Benutzer gehört nicht zu diesem Team.'], Response::HTTP_BAD_REQUEST);
        }

        $price = $pt->isPositive() ? -$pt->getAmount() : $pt->getAmount();

        $entry = new TabEntry();
        $entry->setUser($targetUser);
        $entry->setPenaltyType($pt);
        $entry->setCustomName($pt->getName());
        $entry->setPriceAtBooking($price);
        $entry->setQuantity(1);
        $entry->setEntryDate(new DateTimeImmutable($data['entryDate'] ?? 'today'));
        $entry->setTeam($team);
        $entry->setCreatedByUser($user);

        if (!empty($data['note'])) {
            $entry->setNote($data['note']);
        }

        $this->em->persist($entry);
        $this->em->flush();

        return $this->json([
            'success' => true,
            'entry' => [
                'id' => $entry->getId(),
                'userName' => $targetUser->getFirstName() . ' ' . $targetUser->getLastName(),
                'penaltyName' => $pt->getName(),
                'amount' => $price,
                'isPositive' => $pt->isPositive(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
            ],
        ], Response::HTTP_CREATED);
    }

    #[Route('/team-players/{teamId}', name: 'team_players', methods: ['GET'])]
    public function teamPlayers(int $teamId): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $team = $this->em->getRepository(Team::class)->find($teamId);
        if (!$team) {
            return $this->json(['error' => 'Team nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $coachTeams = $this->getCoachTeams($user);
        if (!isset($coachTeams[$team->getId()]) && !$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $members = $this->teamMembershipService->resolveTeamMembers($team);

        $players = [];
        foreach ($members as $member) {
            $players[] = [
                'userId' => $member->getId(),
                'name' => $member->getFirstName() . ' ' . $member->getLastName(),
            ];
        }

        usort($players, static fn (array $a, array $b) => strcasecmp($a['name'], $b['name']));

        return $this->json(['players' => $players]);
    }

    #[Route('/history', name: 'history', methods: ['GET'])]
    public function history(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user) && !$this->isCoach($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $coachTeams = $this->getCoachTeams($user);
        $teamIds = array_keys($coachTeams);

        $qb = $this->em->getRepository(TabEntry::class)->createQueryBuilder('e')
            ->where('e.penaltyType IS NOT NULL')
            ->orderBy('e.entryDate', 'DESC')
            ->addOrderBy('e.id', 'DESC')
            ->setMaxResults(100);

        if (!$this->isGranted('ROLE_SUPERADMIN')) {
            if (!empty($teamIds)) {
                $qb->andWhere('e.team IN (:teamIds)')->setParameter('teamIds', $teamIds);
            } else {
                return $this->json(['entries' => []]);
            }
        }

        /** @var TabEntry[] $entries */
        $entries = $qb->getQuery()->getResult();

        $result = [];
        foreach ($entries as $entry) {
            $pt = $entry->getPenaltyType();
            $result[] = [
                'id' => $entry->getId(),
                'userName' => $entry->getUser()->getFirstName() . ' ' . $entry->getUser()->getLastName(),
                'userId' => $entry->getUser()->getId(),
                'penaltyName' => $pt?->getName() ?? $entry->getCustomName(),
                'isPositive' => $pt?->isPositive() ?? false,
                'amount' => $entry->getPriceAtBooking(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
                'note' => $entry->getNote(),
                'teamName' => $entry->getTeam()?->getName(),
                'createdBy' => $entry->getCreatedByUser()
                    ? $entry->getCreatedByUser()->getFirstName() . ' ' . $entry->getCreatedByUser()->getLastName()
                    : null,
                'createdAt' => $entry->getCreatedAt()->format('Y-m-d H:i'),
            ];
        }

        return $this->json(['entries' => $result]);
    }
}
