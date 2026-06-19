<?php

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\InventoryCheckout;
use App\Entity\InventoryItem;
use App\Entity\StaffClubAssignment;
use App\Entity\StaffTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Service\UserTeamAccessService;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/inventory', name: 'api_inventory_')]
#[IsGranted('ROLE_USER')]
class InventoryController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserTeamAccessService $teamAccessService,
    ) {
    }

    // ── Access helpers ────────────────────────────────────────────────────────

    /** @return int[] */
    private function getAccessibleTeamIds(User $user): array
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return array_map(
                static fn (Team $t) => $t->getId(),
                $this->em->getRepository(Team::class)->findAll()
            );
        }

        $ids = [];

        foreach ($this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getTeam()) {
                $ids[] = $a->getTeam()->getId();
            }
        }

        foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getTeam()) {
                $ids[] = $a->getTeam()->getId();
            }
        }

        foreach ($this->teamAccessService->getSelfCoachTeams($user) as $team) {
            $ids[] = $team->getId();
        }

        return array_values(array_unique($ids));
    }

    /** @return int[] */
    private function getAccessibleClubIds(User $user): array
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return array_map(
                static fn (Club $c) => $c->getId(),
                $this->em->getRepository(Club::class)->findAll()
            );
        }

        $ids = [];

        foreach ($this->em->getRepository(StaffClubAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getClub()) {
                $ids[] = $a->getClub()->getId();
            }
        }

        foreach ($this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getClub()) {
                $ids[] = $a->getClub()->getId();
            }
        }

        return array_values(array_unique($ids));
    }

    private function canAccess(User $user): bool
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return true;
        }

        return !empty($this->getAccessibleTeamIds($user)) || !empty($this->getAccessibleClubIds($user));
    }

    private function canManageItem(User $user, InventoryItem $item): bool
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return true;
        }

        if ($item->getTeam() && in_array($item->getTeam()->getId(), $this->getAccessibleTeamIds($user), true)) {
            return true;
        }

        if ($item->getClub() && in_array($item->getClub()->getId(), $this->getAccessibleClubIds($user), true)) {
            return true;
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeItem(InventoryItem $item): array
    {
        $activeCheckoutQty = 0;
        $activeCheckouts = [];
        foreach ($item->getCheckouts() as $checkout) {
            if (!$checkout->isReturned()) {
                $activeCheckoutQty += $checkout->getQuantity();
                $activeCheckouts[] = $this->serializeCheckout($checkout);
            }
        }

        return [
            'id' => $item->getId(),
            'name' => $item->getName(),
            'description' => $item->getDescription(),
            'category' => $item->getCategory(),
            'totalQuantity' => $item->getTotalQuantity(),
            'checkedOutQuantity' => $activeCheckoutQty,
            'availableQuantity' => max(0, $item->getTotalQuantity() - $activeCheckoutQty),
            'unit' => $item->getUnit(),
            'condition' => $item->getCondition(),
            'notes' => $item->getNotes(),
            'teamId' => $item->getTeam()?->getId(),
            'teamName' => $item->getTeam()?->getName(),
            'clubId' => $item->getClub()?->getId(),
            'clubName' => $item->getClub()?->getName(),
            'createdAt' => $item->getCreatedAt()->format('c'),
            'updatedAt' => $item->getUpdatedAt()?->format('c'),
            'activeCheckouts' => $activeCheckouts,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCheckout(InventoryCheckout $checkout): array
    {
        return [
            'id' => $checkout->getId(),
            'itemId' => $checkout->getInventoryItem()?->getId(),
            'itemName' => $checkout->getInventoryItem()?->getName(),
            'itemUnit' => $checkout->getInventoryItem()?->getUnit(),
            'userId' => $checkout->getUser()?->getId(),
            'borrowerName' => $checkout->getDisplayName(),
            'quantity' => $checkout->getQuantity(),
            'checkedOutAt' => $checkout->getCheckedOutAt()->format('c'),
            'dueDate' => $checkout->getDueDate()?->format('Y-m-d'),
            'returnedAt' => $checkout->getReturnedAt()?->format('c'),
            'isReturned' => $checkout->isReturned(),
            'note' => $checkout->getNote(),
            'checkedOutByUserId' => $checkout->getCheckedOutByUser()?->getId(),
        ];
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->canAccess($user)) {
            return $this->json(['items' => [], 'canWrite' => false]);
        }

        $teamIds = $this->getAccessibleTeamIds($user);
        $clubIds = $this->getAccessibleClubIds($user);

        $filterTeamId = $request->query->get('teamId');
        $filterClubId = $request->query->get('clubId');

        $qb = $this->em->getRepository(InventoryItem::class)
            ->createQueryBuilder('i')
            ->orderBy('i.category', 'ASC')
            ->addOrderBy('i.name', 'ASC');

        if (null !== $filterTeamId) {
            $tid = (int) $filterTeamId;
            if (!in_array($tid, $teamIds, true) && !$this->isGranted('ROLE_ADMIN')) {
                return $this->json(['message' => 'Kein Zugriff auf dieses Team'], Response::HTTP_FORBIDDEN);
            }
            $qb->andWhere('i.team = :team')->setParameter('team', $tid);
        } elseif (null !== $filterClubId) {
            $cid = (int) $filterClubId;
            if (!in_array($cid, $clubIds, true) && !$this->isGranted('ROLE_ADMIN')) {
                return $this->json(['message' => 'Kein Zugriff auf diesen Verein'], Response::HTTP_FORBIDDEN);
            }
            $qb->andWhere('i.club = :club')->setParameter('club', $cid);
        } else {
            // Show all accessible items
            $conditions = [];
            if (!empty($teamIds)) {
                $qb->setParameter('teamIds', $teamIds);
                $conditions[] = 'i.team IN (:teamIds)';
            }
            if (!empty($clubIds)) {
                $qb->setParameter('clubIds', $clubIds);
                $conditions[] = 'i.club IN (:clubIds)';
            }
            if (!empty($conditions)) {
                $qb->andWhere(implode(' OR ', $conditions));
            }
        }

        /** @var InventoryItem[] $items */
        $items = $qb->getQuery()->getResult();

        return $this->json([
            'items' => array_map(fn (InventoryItem $i) => $this->serializeItem($i), $items),
            'canWrite' => $this->canAccess($user),
            'teamIds' => $teamIds,
            'clubIds' => $clubIds,
        ]);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->canAccess($user)) {
            return $this->json(['message' => 'Kein Zugriff'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        $item = new InventoryItem();
        $item->setName(trim($data['name'] ?? ''));
        $item->setDescription($data['description'] ? trim($data['description']) : null);
        $item->setCategory($data['category'] ? trim($data['category']) : null);
        $item->setTotalQuantity(max(0, (int) ($data['totalQuantity'] ?? 0)));
        $item->setUnit($data['unit'] ?? 'Stück');
        $item->setCondition($data['condition'] ? $data['condition'] : null);
        $item->setNotes($data['notes'] ? trim($data['notes']) : null);
        $item->setCreatedByUser($user);

        if (!empty($data['teamId'])) {
            $tid = (int) $data['teamId'];
            if (!in_array($tid, $this->getAccessibleTeamIds($user), true)) {
                return $this->json(['message' => 'Kein Zugriff auf dieses Team'], Response::HTTP_FORBIDDEN);
            }
            $team = $this->em->getRepository(Team::class)->find($tid);
            if ($team) {
                $item->setTeam($team);
            }
        } elseif (!empty($data['clubId'])) {
            $cid = (int) $data['clubId'];
            if (!in_array($cid, $this->getAccessibleClubIds($user), true)) {
                return $this->json(['message' => 'Kein Zugriff auf diesen Verein'], Response::HTTP_FORBIDDEN);
            }
            $club = $this->em->getRepository(Club::class)->find($cid);
            if ($club) {
                $item->setClub($club);
            }
        }

        if (empty($item->getName())) {
            return $this->json(['message' => 'Name ist erforderlich'], Response::HTTP_BAD_REQUEST);
        }

        $this->em->persist($item);
        $this->em->flush();

        return $this->json(['item' => $this->serializeItem($item)], Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $item = $this->em->getRepository(InventoryItem::class)->find($id);
        if (!$item) {
            return $this->json(['message' => 'Nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canManageItem($user, $item)) {
            return $this->json(['message' => 'Kein Zugriff'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        if (isset($data['name'])) {
            $item->setName(trim($data['name']));
        }
        if (array_key_exists('description', $data)) {
            $item->setDescription($data['description'] ? trim($data['description']) : null);
        }
        if (array_key_exists('category', $data)) {
            $item->setCategory($data['category'] ? trim($data['category']) : null);
        }
        if (isset($data['totalQuantity'])) {
            $item->setTotalQuantity(max(0, (int) $data['totalQuantity']));
        }
        if (isset($data['unit'])) {
            $item->setUnit($data['unit']);
        }
        if (array_key_exists('condition', $data)) {
            $item->setCondition($data['condition'] ?: null);
        }
        if (array_key_exists('notes', $data)) {
            $item->setNotes($data['notes'] ? trim($data['notes']) : null);
        }
        $item->setUpdatedAt(new DateTimeImmutable());

        $this->em->flush();

        return $this->json(['item' => $this->serializeItem($item)]);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $item = $this->em->getRepository(InventoryItem::class)->find($id);
        if (!$item) {
            return $this->json(['message' => 'Nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canManageItem($user, $item)) {
            return $this->json(['message' => 'Kein Zugriff'], Response::HTTP_FORBIDDEN);
        }

        $this->em->remove($item);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/{id}/checkouts', name: 'checkouts_list', methods: ['GET'])]
    public function checkoutsList(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $item = $this->em->getRepository(InventoryItem::class)->find($id);
        if (!$item) {
            return $this->json(['message' => 'Nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canManageItem($user, $item)) {
            return $this->json(['message' => 'Kein Zugriff'], Response::HTTP_FORBIDDEN);
        }

        $onlyActive = $request->query->getBoolean('active', false);
        $checkouts = [];
        foreach ($item->getCheckouts() as $checkout) {
            if ($onlyActive && $checkout->isReturned()) {
                continue;
            }
            $checkouts[] = $this->serializeCheckout($checkout);
        }

        usort($checkouts, static fn ($a, $b) => strcmp($b['checkedOutAt'], $a['checkedOutAt']));

        return $this->json(['checkouts' => $checkouts]);
    }

    #[Route('/checkouts/active', name: 'checkouts_active', methods: ['GET'])]
    public function checkoutsActive(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->canAccess($user)) {
            return $this->json(['checkouts' => []]);
        }

        $teamIds = $this->getAccessibleTeamIds($user);
        $clubIds = $this->getAccessibleClubIds($user);

        $qb = $this->em->getRepository(InventoryCheckout::class)
            ->createQueryBuilder('c')
            ->join('c.inventoryItem', 'i')
            ->where('c.returnedAt IS NULL')
            ->orderBy('c.checkedOutAt', 'DESC');

        $conditions = [];
        if (!empty($teamIds)) {
            $qb->setParameter('teamIds', $teamIds);
            $conditions[] = 'i.team IN (:teamIds)';
        }
        if (!empty($clubIds)) {
            $qb->setParameter('clubIds', $clubIds);
            $conditions[] = 'i.club IN (:clubIds)';
        }

        if (!empty($conditions)) {
            $qb->andWhere(implode(' OR ', $conditions));
        } elseif (!$this->isGranted('ROLE_ADMIN')) {
            return $this->json(['checkouts' => []]);
        }

        /** @var InventoryCheckout[] $checkouts */
        $checkouts = $qb->getQuery()->getResult();

        return $this->json([
            'checkouts' => array_map(fn (InventoryCheckout $c) => $this->serializeCheckout($c), $checkouts),
        ]);
    }

    #[Route('/{id}/checkout', name: 'checkout_create', methods: ['POST'])]
    public function checkoutCreate(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $item = $this->em->getRepository(InventoryItem::class)->find($id);
        if (!$item) {
            return $this->json(['message' => 'Nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canManageItem($user, $item)) {
            return $this->json(['message' => 'Kein Zugriff'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        $quantity = max(1, (int) ($data['quantity'] ?? 1));

        // Check availability
        $checkedOut = 0;
        foreach ($item->getCheckouts() as $c) {
            if (!$c->isReturned()) {
                $checkedOut += $c->getQuantity();
            }
        }
        if ($quantity > ($item->getTotalQuantity() - $checkedOut)) {
            return $this->json(['message' => 'Nicht genug verfügbar'], Response::HTTP_BAD_REQUEST);
        }

        $checkout = new InventoryCheckout();
        $checkout->setInventoryItem($item);
        $checkout->setQuantity($quantity);
        $checkout->setCheckedOutByUser($user);
        $checkout->setNote($data['note'] ? trim($data['note']) : null);

        if (!empty($data['userId'])) {
            $borrower = $this->em->getRepository(User::class)->find((int) $data['userId']);
            if ($borrower) {
                $checkout->setUser($borrower);
                $checkout->setBorrowerName(trim($borrower->getFirstName() . ' ' . $borrower->getLastName()));
            }
        } elseif (!empty($data['borrowerName'])) {
            $checkout->setBorrowerName(trim($data['borrowerName']));
        }

        if (!empty($data['dueDate'])) {
            $due = DateTime::createFromFormat('Y-m-d', $data['dueDate']);
            if ($due) {
                $checkout->setDueDate($due);
            }
        }

        $this->em->persist($checkout);
        $this->em->flush();

        return $this->json(['checkout' => $this->serializeCheckout($checkout)], Response::HTTP_CREATED);
    }

    #[Route('/checkout/{checkoutId}/return', name: 'checkout_return', methods: ['POST'])]
    public function checkoutReturn(int $checkoutId): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $checkout = $this->em->getRepository(InventoryCheckout::class)->find($checkoutId);
        if (!$checkout) {
            return $this->json(['message' => 'Nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        $item = $checkout->getInventoryItem();
        if (!$item || !$this->canManageItem($user, $item)) {
            return $this->json(['message' => 'Kein Zugriff'], Response::HTTP_FORBIDDEN);
        }

        if ($checkout->isReturned()) {
            return $this->json(['message' => 'Bereits zurückgegeben'], Response::HTTP_BAD_REQUEST);
        }

        $checkout->setReturnedAt(new DateTime());
        $this->em->flush();

        return $this->json(['checkout' => $this->serializeCheckout($checkout)]);
    }

    #[Route('/teams-and-clubs', name: 'teams_and_clubs', methods: ['GET'])]
    public function teamsAndClubs(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $teamIds = $this->getAccessibleTeamIds($user);
        $clubIds = $this->getAccessibleClubIds($user);

        // Directly assigned team IDs (independent of admin role) for the `assigned` flag
        $directTeamIds = $this->getDirectTeamIds($user);
        $directClubIds = $this->getDirectClubIds($user);

        $teams = [];
        foreach ($teamIds as $tid) {
            $team = $this->em->getRepository(Team::class)->find($tid);
            if ($team) {
                $teams[] = [
                    'id' => $team->getId(),
                    'name' => $team->getName(),
                    'assigned' => in_array($team->getId(), $directTeamIds, true),
                ];
            }
        }
        usort($teams, static fn ($a, $b) => strcmp($a['name'], $b['name']));

        $clubs = [];
        foreach ($clubIds as $cid) {
            $club = $this->em->getRepository(Club::class)->find($cid);
            if ($club) {
                $clubs[] = [
                    'id' => $club->getId(),
                    'name' => $club->getName(),
                    'assigned' => in_array($club->getId(), $directClubIds, true),
                ];
            }
        }
        usort($clubs, static fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $this->json(['teams' => $teams, 'clubs' => $clubs]);
    }

    /** @return int[] Direct team IDs regardless of admin role */
    private function getDirectTeamIds(User $user): array
    {
        $ids = [];

        foreach ($this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getTeam()) {
                $ids[] = $a->getTeam()->getId();
            }
        }

        foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getTeam()) {
                $ids[] = $a->getTeam()->getId();
            }
        }

        foreach ($this->teamAccessService->getSelfCoachTeams($user) as $team) {
            $ids[] = $team->getId();
        }

        return array_values(array_unique($ids));
    }

    /** @return int[] Direct club IDs regardless of admin role */
    private function getDirectClubIds(User $user): array
    {
        $ids = [];

        foreach ($this->em->getRepository(StaffClubAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getClub()) {
                $ids[] = $a->getClub()->getId();
            }
        }

        foreach ($this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]) as $a) {
            if ($a->getClub()) {
                $ids[] = $a->getClub()->getId();
            }
        }

        return array_values(array_unique($ids));
    }
}
