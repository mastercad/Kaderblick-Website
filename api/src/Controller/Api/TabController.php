<?php

namespace App\Controller\Api;

use App\Entity\CashBook;
use App\Entity\CashBookEntry;
use App\Entity\Club;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\PlayerClubAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\StaffClubAssignment;
use App\Entity\StaffTeamAssignment;
use App\Entity\TabCatalogItem;
use App\Entity\TabEntry;
use App\Entity\TabPayment;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/tab', name: 'api_tab_')]
#[IsGranted('ROLE_USER')]
class TabController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
    ) {
    }

    // -------------------------------------------------------------------------
    // Kassenwart helper methods
    // -------------------------------------------------------------------------

    private function isKassenwart(User $user): bool
    {
        if ($this->isGranted('ROLE_ADMIN')) {
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

    /** @return int[] */
    private function getKassenwartTeamIds(User $user): array
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return array_map(
                static fn (Team $t) => $t->getId(),
                $this->em->getRepository(Team::class)->findAll()
            );
        }

        $ids = [];
        /** @var FunctionaryTeamAssignment[] $teamAssignments */
        $teamAssignments = $this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]);
        foreach ($teamAssignments as $a) {
            if ('Kassenwart' === $a->getFunctionaryTeamAssignmentType()?->getName() && null !== $a->getTeam()) {
                $ids[] = $a->getTeam()->getId();
            }
        }

        return $ids;
    }

    /** @return int[] */
    private function getKassenwartClubIds(User $user): array
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return array_map(
                static fn (Club $c) => $c->getId(),
                $this->em->getRepository(Club::class)->findAll()
            );
        }

        $ids = [];
        /** @var FunctionaryClubAssignment[] $clubAssignments */
        $clubAssignments = $this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]);
        foreach ($clubAssignments as $a) {
            if ('Kassenwart' === $a->getFunctionaryClubAssignmentType()?->getName() && null !== $a->getClub()) {
                $ids[] = $a->getClub()->getId();
            }
        }

        return $ids;
    }

    // -------------------------------------------------------------------------
    // User membership helpers
    // -------------------------------------------------------------------------

    /**
     * Returns all team IDs the given user belongs to in any role
     * (player → via UserRelation, coach → via UserRelation, staff, functionary).
     *
     * @return int[]
     */
    private function getUserTeamIds(User $user): array
    {
        $ids = [];

        // Staff + Functionary have a direct User FK
        foreach ($this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user]) as $a) {
            if (null !== $a->getTeam()) {
                $ids[$a->getTeam()->getId()] = true;
            }
        }
        foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]) as $a) {
            if (null !== $a->getTeam()) {
                $ids[$a->getTeam()->getId()] = true;
            }
        }

        // Player + Coach are linked via UserRelation
        /** @var UserRelation[] $relations */
        $relations = $this->em->getRepository(UserRelation::class)->findBy(['user' => $user]);
        foreach ($relations as $rel) {
            if (null !== $rel->getPlayer()) {
                foreach ($this->em->getRepository(PlayerTeamAssignment::class)->findBy(['player' => $rel->getPlayer()]) as $a) {
                    $ids[$a->getTeam()->getId()] = true;
                }
            }
            if (null !== $rel->getCoach()) {
                foreach ($this->em->getRepository(CoachTeamAssignment::class)->findBy(['coach' => $rel->getCoach()]) as $a) {
                    $ids[$a->getTeam()->getId()] = true;
                }
            }
        }

        return array_keys($ids);
    }

    /**
     * Returns all club IDs the given user belongs to in any role.
     *
     * @return int[]
     */
    private function getUserClubIds(User $user): array
    {
        $ids = [];

        // Staff + Functionary have a direct User FK
        foreach ($this->em->getRepository(StaffClubAssignment::class)->findBy(['user' => $user]) as $a) {
            if (null !== $a->getClub()) {
                $ids[$a->getClub()->getId()] = true;
            }
        }
        foreach ($this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]) as $a) {
            if (null !== $a->getClub()) {
                $ids[$a->getClub()->getId()] = true;
            }
        }

        // Player + Coach are linked via UserRelation
        /** @var UserRelation[] $relations */
        $relations = $this->em->getRepository(UserRelation::class)->findBy(['user' => $user]);
        foreach ($relations as $rel) {
            if (null !== $rel->getPlayer()) {
                foreach ($this->em->getRepository(PlayerClubAssignment::class)->findBy(['player' => $rel->getPlayer()]) as $a) {
                    if (null !== $a->getClub()) {
                        $ids[$a->getClub()->getId()] = true;
                    }
                }
            }
            if (null !== $rel->getCoach()) {
                foreach ($this->em->getRepository(CoachClubAssignment::class)->findBy(['coach' => $rel->getCoach()]) as $a) {
                    if (null !== $a->getClub()) {
                        $ids[$a->getClub()->getId()] = true;
                    }
                }
            }
        }

        return array_keys($ids);
    }

    // -------------------------------------------------------------------------
    // Catalog endpoints
    // -------------------------------------------------------------------------

    /**
     * GET /api/tab/catalog
     * Returns active catalog items visible to the current user:
     *   - Global items (no team/club assigned)
     *   - Items assigned to a team the user belongs to (any role)
     *   - Items assigned to a club the user belongs to (any role)
     * Admins see all active items.
     */
    #[Route('/catalog', name: 'catalog_index', methods: ['GET'])]
    public function catalogIndex(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if ($this->isGranted('ROLE_ADMIN')) {
            $items = $this->em->getRepository(TabCatalogItem::class)->findBy(['active' => true]);
        } else {
            $teamIds = $this->getUserTeamIds($user);
            $clubIds = $this->getUserClubIds($user);

            $qb = $this->em->getRepository(TabCatalogItem::class)->createQueryBuilder('i')
                ->where('i.active = true')
                ->andWhere('i.team IS NULL AND i.club IS NULL' .
                    (count($teamIds) > 0 ? ' OR i.team IN (:teamIds)' : '') .
                    (count($clubIds) > 0 ? ' OR i.club IN (:clubIds)' : ''))
                ->orderBy('i.name', 'ASC');

            if (count($teamIds) > 0) {
                $qb->setParameter('teamIds', $teamIds);
            }
            if (count($clubIds) > 0) {
                $qb->setParameter('clubIds', $clubIds);
            }

            $items = $qb->getQuery()->getResult();
        }

        $result = array_map(function (TabCatalogItem $item) {
            return [
                'id' => $item->getId(),
                'name' => $item->getName(),
                'price' => $item->getPrice(),
                'category' => $item->getCategory(),
                'active' => $item->isActive(),
                'team' => null !== $item->getTeam() ? ['id' => $item->getTeam()->getId(), 'name' => $item->getTeam()->getName()] : null,
                'club' => null !== $item->getClub() ? ['id' => $item->getClub()->getId(), 'name' => $item->getClub()->getName()] : null,
            ];
        }, $items);

        return $this->json($result);
    }

    /**
     * GET /api/tab/management
     * Kassenwart: returns all catalog items (including inactive) + teams + clubs for management UI.
     */
    #[Route('/management', name: 'management', methods: ['GET'])]
    public function management(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $teamIds = $this->getKassenwartTeamIds($user);
        $clubIds = $this->getKassenwartClubIds($user);

        if ($this->isGranted('ROLE_ADMIN')) {
            $items = $this->em->getRepository(TabCatalogItem::class)->findBy([], ['name' => 'ASC']);
        } else {
            $qb = $this->em->getRepository(TabCatalogItem::class)->createQueryBuilder('i')->orderBy('i.name', 'ASC');
            $conditions = [];
            if (count($teamIds) > 0) {
                $conditions[] = 'i.team IN (:teamIds)';
                $qb->setParameter('teamIds', $teamIds);
            }
            if (count($clubIds) > 0) {
                $conditions[] = 'i.club IN (:clubIds)';
                $qb->setParameter('clubIds', $clubIds);
            }
            if (count($conditions) > 0) {
                $qb->where(implode(' OR ', $conditions));
            }
            $items = $qb->getQuery()->getResult();
        }

        $teams = array_map(
            fn (Team $t) => ['id' => $t->getId(), 'name' => $t->getName()],
            $this->em->getRepository(Team::class)->findBy(
                $this->isGranted('ROLE_ADMIN') ? [] : ['id' => $teamIds],
                ['name' => 'ASC']
            )
        );

        $clubs = array_map(
            fn (Club $c) => ['id' => $c->getId(), 'name' => $c->getName()],
            $this->em->getRepository(Club::class)->findBy(
                $this->isGranted('ROLE_ADMIN') ? [] : ['id' => $clubIds],
                ['name' => 'ASC']
            )
        );

        return $this->json([
            'catalog' => array_map(fn (TabCatalogItem $item) => [
                'id' => $item->getId(),
                'name' => $item->getName(),
                'price' => $item->getPrice(),
                'category' => $item->getCategory(),
                'active' => $item->isActive(),
                'team' => null !== $item->getTeam() ? ['id' => $item->getTeam()->getId(), 'name' => $item->getTeam()->getName()] : null,
                'club' => null !== $item->getClub() ? ['id' => $item->getClub()->getId(), 'name' => $item->getClub()->getName()] : null,
            ], $items),
            'teams' => $teams,
            'clubs' => $clubs,
        ]);
    }

    /**
     * POST /api/tab/catalog
     * Kassenwart: create a catalog item.
     * Body: {name, price, category?, teamId?, clubId?}.
     */
    #[Route('/catalog', name: 'catalog_create', methods: ['POST'])]
    public function catalogCreate(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ('' === $name) {
            return $this->json(['error' => 'Bitte einen Namen angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $price = $data['price'] ?? null;
        if (null === $price || !is_numeric($price) || (float) $price < 0) {
            return $this->json(['error' => 'Bitte einen gültigen Preis angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $item = new TabCatalogItem();
        $item->setName($name);
        $item->setPrice((float) $price);
        $item->setCategory(isset($data['category']) && '' !== trim((string) $data['category']) ? trim((string) $data['category']) : null);

        if (!empty($data['teamId'])) {
            $team = $this->em->getRepository(Team::class)->find((int) $data['teamId']);
            if (null === $team) {
                return $this->json(['error' => 'Team nicht gefunden.'], Response::HTTP_NOT_FOUND);
            }
            $item->setTeam($team);
        }

        if (!empty($data['clubId'])) {
            $club = $this->em->getRepository(Club::class)->find((int) $data['clubId']);
            if (null === $club) {
                return $this->json(['error' => 'Verein nicht gefunden.'], Response::HTTP_NOT_FOUND);
            }
            $item->setClub($club);
        }

        $this->em->persist($item);
        $this->em->flush();

        return $this->json([
            'id' => $item->getId(),
            'name' => $item->getName(),
            'price' => $item->getPrice(),
            'category' => $item->getCategory(),
            'active' => $item->isActive(),
        ], Response::HTTP_CREATED);
    }

    /**
     * PUT /api/tab/catalog/{id}
     * Kassenwart: update a catalog item.
     * Body: {name?, price?, category?, active?}.
     */
    #[Route('/catalog/{id}', name: 'catalog_update', methods: ['PUT'])]
    public function catalogUpdate(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $item = $this->em->getRepository(TabCatalogItem::class)->find($id);
        if (null === $item) {
            return $this->json(['error' => 'Artikel nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ('' === $name) {
                return $this->json(['error' => 'Bitte einen Namen angeben.'], Response::HTTP_BAD_REQUEST);
            }
            $item->setName($name);
        }

        if (array_key_exists('price', $data)) {
            $price = $data['price'];
            if (!is_numeric($price) || (float) $price < 0) {
                return $this->json(['error' => 'Bitte einen gültigen Preis angeben.'], Response::HTTP_BAD_REQUEST);
            }
            $item->setPrice((float) $price);
        }

        if (array_key_exists('category', $data)) {
            $category = trim((string) ($data['category'] ?? ''));
            $item->setCategory('' !== $category ? $category : null);
        }

        if (array_key_exists('active', $data)) {
            $item->setActive((bool) $data['active']);
        }

        $this->em->flush();

        return $this->json(['success' => true]);
    }

    /**
     * DELETE /api/tab/catalog/{id}
     * Kassenwart: delete a catalog item (only if no entries reference it).
     */
    #[Route('/catalog/{id}', name: 'catalog_delete', methods: ['DELETE'])]
    public function catalogDelete(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $item = $this->em->getRepository(TabCatalogItem::class)->find($id);
        if (null === $item) {
            return $this->json(['error' => 'Artikel nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $entryCount = $this->em->getRepository(TabEntry::class)->count(['catalogItem' => $item]);
        if ($entryCount > 0) {
            return $this->json(['error' => 'Artikel kann nicht gelöscht werden, da bereits Buchungen existieren.'], Response::HTTP_CONFLICT);
        }

        $this->em->remove($item);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    // -------------------------------------------------------------------------
    // Overview endpoint (Kassenwart)
    // -------------------------------------------------------------------------

    /**
     * GET /api/tab/overview
     * Kassenwart: returns all users with tab entries grouped by user, showing saldo.
     */
    #[Route('/overview', name: 'overview', methods: ['GET'])]
    public function overview(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $teamIds = $this->getKassenwartTeamIds($user);
        $clubIds = $this->getKassenwartClubIds($user);

        // Optional filter by specific team or club (from query params)
        $filterTeamId = $request->query->get('teamId') ? (int) $request->query->get('teamId') : null;
        $filterClubId = $request->query->get('clubId') ? (int) $request->query->get('clubId') : null;

        if (null !== $filterTeamId) {
            $teamIds = in_array($filterTeamId, $teamIds, true) ? [$filterTeamId] : [];
            $clubIds = [];
        } elseif (null !== $filterClubId) {
            $clubIds = in_array($filterClubId, $clubIds, true) ? [$filterClubId] : [];
            $teamIds = [];
        }

        // Fetch all tab entries for accessible teams/clubs
        $entriesQb = $this->em->getRepository(TabEntry::class)->createQueryBuilder('e')
            ->leftJoin('e.catalogItem', 'i')
            ->addSelect('i');

        if (!$this->isGranted('ROLE_ADMIN') && 0 === count($teamIds) && 0 === count($clubIds)) {
            return $this->json([]);
        }

        if (!$this->isGranted('ROLE_ADMIN')) {
            $conditions = [];
            if (count($teamIds) > 0) {
                $conditions[] = 'e.team IN (:teamIds)';
                $entriesQb->setParameter('teamIds', $teamIds);
            }
            if (count($clubIds) > 0) {
                $conditions[] = 'e.club IN (:clubIds)';
                $entriesQb->setParameter('clubIds', $clubIds);
            }
            if (count($conditions) > 0) {
                $entriesQb->where(implode(' OR ', $conditions));
            }
        }

        /** @var TabEntry[] $allEntries */
        $allEntries = $entriesQb->getQuery()->getResult();

        // Fetch all tab payments for accessible teams/clubs
        $paymentsQb = $this->em->getRepository(TabPayment::class)->createQueryBuilder('p');

        if (!$this->isGranted('ROLE_ADMIN')) {
            $conditions = [];
            if (count($teamIds) > 0) {
                $conditions[] = 'p.team IN (:teamIds)';
                $paymentsQb->setParameter('teamIds', $teamIds);
            }
            if (count($clubIds) > 0) {
                $conditions[] = 'p.club IN (:clubIds)';
                $paymentsQb->setParameter('clubIds', $clubIds);
            }
            if (count($conditions) > 0) {
                $paymentsQb->where(implode(' OR ', $conditions));
            }
        }

        /** @var TabPayment[] $allPayments */
        $allPayments = $paymentsQb->getQuery()->getResult();

        // Group entries by user + context (team/club from catalog item)
        // Key: userId_teamId_clubId
        $userContextMap = [];

        foreach ($allEntries as $entry) {
            $userId = $entry->getUser()->getId();
            $teamId = $entry->getTeam()?->getId();
            $clubId = $entry->getClub()?->getId();
            $key = $userId . '_' . ($teamId ?? 'null') . '_' . ($clubId ?? 'null');

            if (!isset($userContextMap[$key])) {
                $entityName = null !== $entry->getTeam() ? $entry->getTeam()->getName() : ($entry->getClub()?->getName() ?? '');
                $userContextMap[$key] = [
                    'userId' => $userId,
                    'fullName' => $entry->getUser()->getFullName(),
                    'teamId' => $teamId,
                    'clubId' => $clubId,
                    'entityName' => $entityName,
                    'totalConsumed' => 0.0,
                    'totalPaid' => 0.0,
                    'entries' => [],
                    'payments' => [],
                ];
            }

            $item = $entry->getCatalogItem();
            $lineTotal = $entry->getPriceAtBooking() * $entry->getQuantity();
            $userContextMap[$key]['totalConsumed'] += $lineTotal;
            $userContextMap[$key]['entries'][] = [
                'id' => $entry->getId(),
                'catalogItem' => null !== $item ? [
                    'name' => $item->getName(),
                    'price' => $item->getPrice(),
                    'category' => $item->getCategory(),
                ] : null,
                'customName' => $entry->getCustomName(),
                'effectiveName' => $entry->getEffectiveName(),
                'quantity' => $entry->getQuantity(),
                'priceAtBooking' => $entry->getPriceAtBooking(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
                'note' => $entry->getNote(),
                'penaltyType' => null !== $entry->getPenaltyType() ? [
                    'id' => $entry->getPenaltyType()->getId(),
                    'name' => $entry->getPenaltyType()->getName(),
                    'isPositive' => $entry->getPenaltyType()->isPositive(),
                ] : null,
                'isPenalty' => $entry->isPenalty(),
            ];
        }

        foreach ($allPayments as $payment) {
            $userId = $payment->getUser()->getId();
            $teamId = $payment->getTeam()?->getId();
            $clubId = $payment->getClub()?->getId();
            $key = $userId . '_' . ($teamId ?? 'null') . '_' . ($clubId ?? 'null');

            if (!isset($userContextMap[$key])) {
                $entityName = null !== $payment->getTeam() ? $payment->getTeam()->getName() : ($payment->getClub()?->getName() ?? '');
                $userContextMap[$key] = [
                    'userId' => $userId,
                    'fullName' => $payment->getUser()->getFullName(),
                    'teamId' => $teamId,
                    'clubId' => $clubId,
                    'entityName' => $entityName,
                    'totalConsumed' => 0.0,
                    'totalPaid' => 0.0,
                    'entries' => [],
                    'payments' => [],
                ];
            }

            $userContextMap[$key]['totalPaid'] += $payment->getAmount();
            $userContextMap[$key]['payments'][] = [
                'id' => $payment->getId(),
                'amount' => $payment->getAmount(),
                'note' => $payment->getNote(),
                'paymentDate' => $payment->getPaymentDate()->format('Y-m-d'),
            ];
        }

        $result = array_values(array_map(function (array $entry) {
            $totalConsumed = round($entry['totalConsumed'], 2);
            $totalPaid = round($entry['totalPaid'], 2);

            return [
                'userId' => $entry['userId'],
                'fullName' => $entry['fullName'],
                'teamId' => $entry['teamId'],
                'clubId' => $entry['clubId'],
                'entityName' => $entry['entityName'],
                'totalConsumed' => $totalConsumed,
                'totalPaid' => $totalPaid,
                'saldo' => round($totalPaid - $totalConsumed, 2),
                'entries' => $entry['entries'],
                'payments' => $entry['payments'],
            ];
        }, $userContextMap));

        return $this->json($result);
    }

    // -------------------------------------------------------------------------
    // Payment endpoints (Kassenwart)
    // -------------------------------------------------------------------------

    /**
     * POST /api/tab/payments
     * Kassenwart: record a payment for a user.
     * Body: {userId, amount, note?, paymentDate, teamId?, clubId?}.
     */
    #[Route('/payments', name: 'payments_create', methods: ['POST'])]
    public function paymentsCreate(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        $userId = $data['userId'] ?? null;
        if (null === $userId) {
            return $this->json(['error' => 'Bitte einen Benutzer angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $targetUser = $this->em->getRepository(User::class)->find((int) $userId);
        if (null === $targetUser) {
            return $this->json(['error' => 'Benutzer nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        // Verify target user belongs to one of the Kassenwart's teams/clubs
        if (!$this->isGranted('ROLE_ADMIN')) {
            $targetTeamIds = $this->getUserTeamIds($targetUser);
            $targetClubIds = $this->getUserClubIds($targetUser);
            $kassenwartTeamIds = $this->getKassenwartTeamIds($user);
            $kassenwartClubIds = $this->getKassenwartClubIds($user);
            $hasOverlap = count(array_intersect($targetTeamIds, $kassenwartTeamIds)) > 0
                || count(array_intersect($targetClubIds, $kassenwartClubIds)) > 0;
            if (!$hasOverlap) {
                return $this->json(['error' => 'Der Benutzer gehört keinem deiner verwalteten Teams/Vereine an.'], Response::HTTP_FORBIDDEN);
            }
        }

        $amount = $data['amount'] ?? null;
        if (null === $amount || !is_numeric($amount) || (float) $amount <= 0) {
            return $this->json(['error' => 'Bitte einen positiven Betrag angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $paymentDateStr = $data['paymentDate'] ?? null;
        if (!is_string($paymentDateStr) || '' === trim($paymentDateStr)) {
            return $this->json(['error' => 'Bitte ein gültiges Datum angeben.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $paymentDate = new DateTime($paymentDateStr);
        } catch (Exception) {
            return $this->json(['error' => 'Das Datum ist ungültig.'], Response::HTTP_BAD_REQUEST);
        }

        $payment = new TabPayment();
        $payment->setUser($targetUser);
        $payment->setAmount((float) $amount);
        $payment->setNote(isset($data['note']) && '' !== trim((string) $data['note']) ? trim((string) $data['note']) : null);
        $payment->setPaymentDate($paymentDate);
        $payment->setRecordedByUser($user);

        if (!empty($data['teamId'])) {
            $team = $this->em->getRepository(Team::class)->find((int) $data['teamId']);
            if (null === $team) {
                return $this->json(['error' => 'Team nicht gefunden.'], Response::HTTP_NOT_FOUND);
            }
            $payment->setTeam($team);
        }

        if (!empty($data['clubId'])) {
            $club = $this->em->getRepository(Club::class)->find((int) $data['clubId']);
            if (null === $club) {
                return $this->json(['error' => 'Verein nicht gefunden.'], Response::HTTP_NOT_FOUND);
            }
            $payment->setClub($club);
        }

        $this->em->persist($payment);

        // Auto-create a CashBook income entry for the Deckel payment
        $cashBook = null;
        if (null !== $payment->getTeam()) {
            $cashBook = $this->em->getRepository(CashBook::class)->findOneBy(['team' => $payment->getTeam()]);
        } elseif (null !== $payment->getClub()) {
            $cashBook = $this->em->getRepository(CashBook::class)->findOneBy(['club' => $payment->getClub()]);
        }

        $cbEntry = null;
        if (null !== $cashBook) {
            $cbEntry = new CashBookEntry();
            $cbEntry->setCashBook($cashBook);
            $cbEntry->setAmount($payment->getAmount());
            $cbEntry->setType('income');
            $cbEntry->setCategory('Deckel-Zahlungen');
            $cbEntry->setDescription('Deckel-Zahlung von ' . $targetUser->getFullName() . ($payment->getNote() ? ' (' . $payment->getNote() . ')' : ''));
            $cbEntry->setEntryDate(new DateTimeImmutable($payment->getPaymentDate()->format('Y-m-d')));
            $cbEntry->setCreatedByUser($user);
            $cbEntry->setReferenceType('tab_payment');
            $this->em->persist($cbEntry);
        }

        $this->em->flush();

        // Set referenceId after flush (payment now has an ID)
        if (null !== $cbEntry) {
            $cbEntry->setReferenceId($payment->getId());
            $this->em->flush();
        }

        return $this->json([
            'success' => true,
            'payment' => [
                'id' => $payment->getId(),
                'amount' => $payment->getAmount(),
                'note' => $payment->getNote(),
                'paymentDate' => $payment->getPaymentDate()->format('Y-m-d'),
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * DELETE /api/tab/payments/{id}
     * Kassenwart: delete a payment.
     */
    #[Route('/payments/{id}', name: 'payments_delete', methods: ['DELETE'])]
    public function paymentsDelete(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isKassenwart($user)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $payment = $this->em->getRepository(TabPayment::class)->find($id);
        if (null === $payment) {
            return $this->json(['error' => 'Zahlung nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        // Remove corresponding CashBook entry if one was auto-created
        $linkedCbEntry = $this->em->getRepository(CashBookEntry::class)->findOneBy([
            'referenceType' => 'tab_payment',
            'referenceId' => $payment->getId(),
        ]);
        if (null !== $linkedCbEntry) {
            $this->em->remove($linkedCbEntry);
        }

        $this->em->remove($payment);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    // -------------------------------------------------------------------------
    // User-facing endpoints
    // -------------------------------------------------------------------------

    /**
     * GET /api/tab/my-entries
     * User: own entries + saldo.
     */
    #[Route('/my-entries', name: 'my_entries', methods: ['GET'])]
    public function myEntries(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        /** @var TabEntry[] $entries */
        $entries = $this->em->getRepository(TabEntry::class)->findBy(
            ['user' => $user],
            ['entryDate' => 'DESC', 'id' => 'DESC']
        );

        /** @var TabPayment[] $payments */
        $payments = $this->em->getRepository(TabPayment::class)->findBy(['user' => $user]);

        $totalConsumed = 0.0;
        foreach ($entries as $entry) {
            $totalConsumed += $entry->getPriceAtBooking() * $entry->getQuantity();
        }
        $totalConsumed = round($totalConsumed, 2);

        $totalPaid = 0.0;
        foreach ($payments as $payment) {
            $totalPaid += $payment->getAmount();
        }
        $totalPaid = round($totalPaid, 2);

        $serializedEntries = array_map(function (TabEntry $entry) {
            $item = $entry->getCatalogItem();

            return [
                'id' => $entry->getId(),
                'catalogItem' => null !== $item ? [
                    'name' => $item->getName(),
                    'price' => $item->getPrice(),
                    'category' => $item->getCategory(),
                    'team' => null !== $item->getTeam() ? ['id' => $item->getTeam()->getId(), 'name' => $item->getTeam()->getName()] : null,
                    'club' => null !== $item->getClub() ? ['id' => $item->getClub()->getId(), 'name' => $item->getClub()->getName()] : null,
                ] : null,
                'customName' => $entry->getCustomName(),
                'customPrice' => $entry->getCustomPrice(),
                'effectiveName' => $entry->getEffectiveName(),
                'quantity' => $entry->getQuantity(),
                'priceAtBooking' => $entry->getPriceAtBooking(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
                'note' => $entry->getNote(),
                'penaltyType' => null !== $entry->getPenaltyType() ? [
                    'id' => $entry->getPenaltyType()->getId(),
                    'name' => $entry->getPenaltyType()->getName(),
                    'isPositive' => $entry->getPenaltyType()->isPositive(),
                ] : null,
                'isPenalty' => $entry->isPenalty(),
            ];
        }, $entries);

        return $this->json([
            'entries' => $serializedEntries,
            'totalConsumed' => $totalConsumed,
            'totalPaid' => $totalPaid,
            'saldo' => round($totalPaid - $totalConsumed, 2),
        ]);
    }

    /**
     * POST /api/tab/book
     * User: book an item from the catalog or as a free-form entry.
     * Catalog booking:   {catalogItemId, quantity?, note?, entryDate}
     * Free-form booking: {customName, customPrice, quantity?, note?, entryDate}.
     */
    #[Route('/book', name: 'book', methods: ['POST'])]
    public function book(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        $catalogItemId = $data['catalogItemId'] ?? null;
        $customName = trim((string) ($data['customName'] ?? ''));
        $customPrice = $data['customPrice'] ?? null;

        if (null === $catalogItemId && '' === $customName) {
            return $this->json(['error' => 'Bitte einen Artikel auswählen oder einen Namen für die freie Buchung angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $quantity = isset($data['quantity']) ? (int) $data['quantity'] : 1;
        if ($quantity < 1) {
            return $this->json(['error' => 'Menge muss mindestens 1 sein.'], Response::HTTP_BAD_REQUEST);
        }

        $entryDateStr = $data['entryDate'] ?? null;
        if (!is_string($entryDateStr) || '' === trim($entryDateStr)) {
            return $this->json(['error' => 'Bitte ein gültiges Datum angeben.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $entryDate = new DateTime($entryDateStr);
        } catch (Exception) {
            return $this->json(['error' => 'Das Datum ist ungültig.'], Response::HTTP_BAD_REQUEST);
        }

        $entry = new TabEntry();
        $entry->setUser($user);
        $entry->setQuantity($quantity);
        $entry->setEntryDate($entryDate);
        $entry->setNote(isset($data['note']) && '' !== trim((string) $data['note']) ? trim((string) $data['note']) : null);
        $entry->setCreatedByUser($user);

        if (null !== $catalogItemId) {
            $item = $this->em->getRepository(TabCatalogItem::class)->find((int) $catalogItemId);
            if (null === $item || !$item->isActive()) {
                return $this->json(['error' => 'Artikel nicht gefunden oder nicht aktiv.'], Response::HTTP_NOT_FOUND);
            }
            $entry->setCatalogItem($item);
            $entry->setPriceAtBooking($item->getPrice());
            $entry->setTeam($item->getTeam());
            $entry->setClub($item->getClub());
        } else {
            if (null === $customPrice || !is_numeric($customPrice) || (float) $customPrice < 0) {
                return $this->json(['error' => 'Bitte einen gültigen Preis angeben.'], Response::HTTP_BAD_REQUEST);
            }
            $entry->setCustomName($customName);
            $entry->setCustomPrice((float) $customPrice);
            $entry->setPriceAtBooking((float) $customPrice);

            // Assign context from request (teamId / clubId)
            if (!empty($data['teamId'])) {
                $team = $this->em->getRepository(Team::class)->find((int) $data['teamId']);
                if (null !== $team) {
                    $entry->setTeam($team);
                }
            }
            if (!empty($data['clubId'])) {
                $club = $this->em->getRepository(Club::class)->find((int) $data['clubId']);
                if (null !== $club) {
                    $entry->setClub($club);
                }
            }
        }

        $this->em->persist($entry);
        $this->em->flush();

        return $this->json([
            'success' => true,
            'entry' => [
                'id' => $entry->getId(),
                'catalogItem' => null !== $entry->getCatalogItem() ? [
                    'name' => $entry->getCatalogItem()->getName(),
                    'price' => $entry->getCatalogItem()->getPrice(),
                    'category' => $entry->getCatalogItem()->getCategory(),
                ] : null,
                'customName' => $entry->getCustomName(),
                'customPrice' => $entry->getCustomPrice(),
                'effectiveName' => $entry->getEffectiveName(),
                'quantity' => $entry->getQuantity(),
                'priceAtBooking' => $entry->getPriceAtBooking(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
                'note' => $entry->getNote(),
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * PUT /api/tab/entries/{id}
     * User: update own entry (quantity, note, entryDate).
     * Body: {quantity?, note?, entryDate?}.
     */
    #[Route('/entries/{id}', name: 'entries_update', methods: ['PUT'])]
    public function entriesUpdate(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $entry = $this->em->getRepository(TabEntry::class)->find($id);
        if (null === $entry) {
            return $this->json(['error' => 'Eintrag nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if ($entry->getUser()->getId() !== $user->getId() && !$this->isGranted('ROLE_ADMIN')) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('quantity', $data)) {
            $qty = (int) $data['quantity'];
            if ($qty < 1) {
                return $this->json(['error' => 'Menge muss mindestens 1 sein.'], Response::HTTP_BAD_REQUEST);
            }
            $entry->setQuantity($qty);
        }

        if (array_key_exists('note', $data)) {
            $note = trim((string) ($data['note'] ?? ''));
            $entry->setNote('' !== $note ? $note : null);
        }

        if (array_key_exists('entryDate', $data)) {
            try {
                $entry->setEntryDate(new DateTime((string) $data['entryDate']));
            } catch (Exception) {
                return $this->json(['error' => 'Ungültiges Datum.'], Response::HTTP_BAD_REQUEST);
            }
        }

        $this->em->flush();

        return $this->json(['success' => true]);
    }

    /**
     * DELETE /api/tab/entries/{id}
     * User: delete own entry.
     */
    #[Route('/entries/{id}', name: 'entries_delete', methods: ['DELETE'])]
    public function entriesDelete(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $entry = $this->em->getRepository(TabEntry::class)->find($id);
        if (null === $entry) {
            return $this->json(['error' => 'Eintrag nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if ($entry->getUser()->getId() !== $user->getId() && !$this->isGranted('ROLE_ADMIN')) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        if ($entry->isPenalty() && !$this->isGranted('ROLE_ADMIN') && !$this->isKassenwart($user)) {
            if ($entry->getCreatedByUser()?->getId() !== $user->getId()) {
                return $this->json(['error' => 'Strafen können nur vom Kassenwart oder dem zuweisenden Trainer gelöscht werden.'], Response::HTTP_FORBIDDEN);
            }
        }

        // Block deletion if a payment exists for this user in the same context after the entry date
        if (!$this->isGranted('ROLE_ADMIN') && !$this->isKassenwart($user)) {
            $qb = $this->em->getRepository(TabPayment::class)->createQueryBuilder('p')
                ->where('p.user = :userId')
                ->andWhere('p.paymentDate >= :entryDate')
                ->setParameter('userId', $entry->getUser()->getId())
                ->setParameter('entryDate', $entry->getEntryDate())
                ->setMaxResults(1);

            if (null !== $entry->getTeam()) {
                $qb->andWhere('p.team = :team')->setParameter('team', $entry->getTeam());
            } elseif (null !== $entry->getClub()) {
                $qb->andWhere('p.club = :club')->setParameter('club', $entry->getClub());
            }

            if (null !== $qb->getQuery()->getOneOrNullResult()) {
                return $this->json(['error' => 'Buchung kann nicht gelöscht werden — es existiert bereits eine Zahlung nach diesem Datum.'], Response::HTTP_CONFLICT);
            }
        }

        $this->em->remove($entry);
        $this->em->flush();

        return $this->json(['success' => true]);
    }
}
