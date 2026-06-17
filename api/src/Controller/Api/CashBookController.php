<?php

namespace App\Controller\Api;

use App\Entity\CashBook;
use App\Entity\CashBookEntry;
use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\CashBookEntryRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/cash-books', name: 'api_cash_books_')]
#[IsGranted('ROLE_USER')]
class CashBookController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
    ) {
    }

    /**
     * Returns all cash books accessible to the current user.
     * For each team/club where the user is Kassenwart, a CashBook is auto-created if none exists yet.
     *
     * @return CashBook[]
     */
    private function getAccessibleCashBooks(User $user): array
    {
        $cashBooks = [];

        // Always auto-create missing CashBooks for all Kassenwart assignments (also for admins)

        // --- Team cash books via FunctionaryTeamAssignment with type "Kassenwart" ---
        /** @var FunctionaryTeamAssignment[] $teamAssignments */
        $teamAssignments = $this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]);

        foreach ($teamAssignments as $assignment) {
            $type = $assignment->getFunctionaryTeamAssignmentType();
            if (null === $type || 'Kassenwart' !== $type->getName()) {
                continue;
            }
            $team = $assignment->getTeam();
            if (null === $team) {
                continue;
            }
            $cashBook = $this->em->getRepository(CashBook::class)->findOneBy(['team' => $team]);
            if (null === $cashBook) {
                $cashBook = new CashBook();
                $cashBook->setTeam($team);
                $cashBook->setName($team->getName());
                $this->em->persist($cashBook);
            }
            $cashBooks['team_' . $team->getId()] = $cashBook;
        }

        // --- Club cash books via FunctionaryClubAssignment with type "Kassenwart" ---
        /** @var FunctionaryClubAssignment[] $clubAssignments */
        $clubAssignments = $this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]);

        foreach ($clubAssignments as $assignment) {
            $type = $assignment->getFunctionaryClubAssignmentType();
            if (null === $type || 'Kassenwart' !== $type->getName()) {
                continue;
            }
            $club = $assignment->getClub();
            if (null === $club) {
                continue;
            }
            $cashBook = $this->em->getRepository(CashBook::class)->findOneBy(['club' => $club]);
            if (null === $cashBook) {
                $cashBook = new CashBook();
                $cashBook->setClub($club);
                $cashBook->setName($club->getName());
                $this->em->persist($cashBook);
            }
            $cashBooks['club_' . $club->getId()] = $cashBook;
        }

        if (count($cashBooks) > 0) {
            $this->em->flush();
        }

        // Admins see all books (including ones created by other Kassenwarte)
        if ($this->isGranted('ROLE_ADMIN')) {
            return $this->em->getRepository(CashBook::class)->findAll();
        }

        return array_values($cashBooks);
    }

    private function canAccessCashBook(User $user, CashBook $cashBook): bool
    {
        if ($this->isGranted('ROLE_ADMIN')) {
            return true;
        }

        $team = $cashBook->getTeam();
        $club = $cashBook->getClub();

        if (null !== $team) {
            /** @var FunctionaryTeamAssignment[] $assignments */
            $assignments = $this->em->getRepository(FunctionaryTeamAssignment::class)->findBy([
                'user' => $user,
                'team' => $team,
            ]);
            foreach ($assignments as $assignment) {
                $type = $assignment->getFunctionaryTeamAssignmentType();
                if (null !== $type && 'Kassenwart' === $type->getName()) {
                    return true;
                }
            }
        }

        if (null !== $club) {
            /** @var FunctionaryClubAssignment[] $assignments */
            $assignments = $this->em->getRepository(FunctionaryClubAssignment::class)->findBy([
                'user' => $user,
                'club' => $club,
            ]);
            foreach ($assignments as $assignment) {
                $type = $assignment->getFunctionaryClubAssignmentType();
                if (null !== $type && 'Kassenwart' === $type->getName()) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Computes balance totals for a list of entries.
     *
     * @param CashBookEntry[] $entries
     *
     * @return array{balance: float, incomeTotal: float, expenseTotal: float}
     */
    private function computeTotals(array $entries, float $openingBalance = 0.0): array
    {
        $incomeTotal = 0.0;
        $expenseTotal = 0.0;
        foreach ($entries as $entry) {
            if ('income' === $entry->getType()) {
                $incomeTotal += $entry->getAmount();
            } else {
                $expenseTotal += $entry->getAmount();
            }
        }

        return [
            'balance' => round($openingBalance + $incomeTotal - $expenseTotal, 2),
            'incomeTotal' => round($incomeTotal, 2),
            'expenseTotal' => round($expenseTotal, 2),
        ];
    }

    /**
     * GET /api/cash-books
     * Returns a list of cash books accessible to the current user with computed balance totals.
     */
    #[Route('', name: 'index', methods: ['GET'])]
    public function index(CashBookEntryRepository $entryRepository): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBooks = $this->getAccessibleCashBooks($user);

        if (0 === count($cashBooks)) {
            return $this->json([]);
        }

        // Aggregate totals in a single query to avoid N+1
        $bookIds = array_map(fn (CashBook $cb) => $cb->getId(), $cashBooks);
        $totalsRaw = $this->em->createQueryBuilder()
            ->select('IDENTITY(e.cashBook) AS bookId, e.type, SUM(e.amount) AS total')
            ->from(CashBookEntry::class, 'e')
            ->where('e.cashBook IN (:ids)')
            ->setParameter('ids', $bookIds)
            ->groupBy('e.cashBook, e.type')
            ->getQuery()
            ->getArrayResult();

        $totalsMap = [];
        foreach ($totalsRaw as $row) {
            $bid = (int) $row['bookId'];
            if (!isset($totalsMap[$bid])) {
                $totalsMap[$bid] = ['income' => 0.0, 'expense' => 0.0];
            }
            $totalsMap[$bid][$row['type']] = (float) $row['total'];
        }

        $result = array_map(function (CashBook $cashBook) use ($totalsMap) {
            $bid = $cashBook->getId();
            $income = $totalsMap[$bid]['income'] ?? 0.0;
            $expense = $totalsMap[$bid]['expense'] ?? 0.0;
            $openingBalance = $cashBook->getOpeningBalance();

            $type = null !== $cashBook->getTeam() ? 'team' : 'club';
            $entityName = null !== $cashBook->getTeam()
                ? $cashBook->getTeam()->getName()
                : (null !== $cashBook->getClub() ? $cashBook->getClub()->getName() : $cashBook->getName());

            return [
                'id' => $cashBook->getId(),
                'name' => $cashBook->getName(),
                'type' => $type,
                'entityName' => $entityName,
                'teamId' => null !== $cashBook->getTeam() ? $cashBook->getTeam()->getId() : null,
                'clubId' => null !== $cashBook->getClub() ? $cashBook->getClub()->getId() : null,
                'openingBalance' => $openingBalance,
                'balance' => round($openingBalance + $income - $expense, 2),
                'incomeTotal' => round($income, 2),
                'expenseTotal' => round($expense, 2),
            ];
        }, $cashBooks);

        return $this->json($result);
    }

    /**
     * GET /api/cash-books/{id}/entries
     * Returns all entries for a cash book with running balance per entry (DESC order).
     */
    #[Route('/{id}/entries', name: 'entries', methods: ['GET'])]
    public function entries(int $id, CashBookEntryRepository $entryRepository): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBook = $this->em->getRepository(CashBook::class)->find($id);
        if (null === $cashBook) {
            return $this->json(['error' => 'Kassenbuch nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canAccessCashBook($user, $cashBook)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        // All entries ordered DESC (newest first) for display
        $entriesDesc = $entryRepository->findByCashBookOrdered($cashBook);

        // Compute overall totals
        $totals = $this->computeTotals($entriesDesc, $cashBook->getOpeningBalance());

        // Compute running balance: we need to go from oldest to newest
        // so reverse to ASC, accumulate balance, then re-reverse
        $entriesAsc = array_reverse($entriesDesc);
        $runningBalance = $cashBook->getOpeningBalance();
        $balanceByEntryId = [];
        foreach ($entriesAsc as $entry) {
            if ('income' === $entry->getType()) {
                $runningBalance += $entry->getAmount();
            } else {
                $runningBalance -= $entry->getAmount();
            }
            $balanceByEntryId[$entry->getId()] = round($runningBalance, 2);
        }

        $serializedEntries = array_map(function (CashBookEntry $entry) use ($balanceByEntryId) {
            return [
                'id' => $entry->getId(),
                'amount' => $entry->getAmount(),
                'type' => $entry->getType(),
                'category' => $entry->getCategory(),
                'description' => $entry->getDescription(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
                'createdByUser' => null !== $entry->getCreatedByUser() ? [
                    'fullName' => $entry->getCreatedByUser()->getFullName(),
                ] : null,
                'balance' => $balanceByEntryId[$entry->getId()] ?? null,
            ];
        }, $entriesDesc);

        return $this->json([
            'cashBook' => [
                'id' => $cashBook->getId(),
                'name' => $cashBook->getName(),
                'type' => null !== $cashBook->getTeam() ? 'team' : 'club',
                'openingBalance' => $cashBook->getOpeningBalance(),
                'createdAt' => $cashBook->getCreatedAt()->format('Y-m-d H:i:s'),
            ],
            'entries' => $serializedEntries,
            'balance' => $totals['balance'],
            'incomeTotal' => $totals['incomeTotal'],
            'expenseTotal' => $totals['expenseTotal'],
        ]);
    }

    /**
     * POST /api/cash-books/{id}/entries
     * Creates a new entry in the given cash book.
     * Body: {amount, type, category?, description, entryDate}.
     */
    #[Route('/{id}/entries', name: 'create_entry', methods: ['POST'])]
    public function createEntry(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBook = $this->em->getRepository(CashBook::class)->find($id);
        if (null === $cashBook) {
            return $this->json(['error' => 'Kassenbuch nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canAccessCashBook($user, $cashBook)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        $validationError = $this->validateEntryPayload($data);
        if (null !== $validationError) {
            return $validationError;
        }

        $entry = new CashBookEntry();
        $entry->setCashBook($cashBook);
        $entry->setAmount((float) $data['amount']);
        $entry->setType((string) $data['type']);
        $entry->setCategory(isset($data['category']) && '' !== trim((string) $data['category']) ? trim((string) $data['category']) : null);
        $entry->setDescription(trim((string) $data['description']));
        $entry->setEntryDate(new DateTimeImmutable((string) $data['entryDate']));
        $entry->setCreatedByUser($user);

        $this->em->persist($entry);
        $this->em->flush();

        return $this->json([
            'success' => true,
            'entry' => [
                'id' => $entry->getId(),
                'amount' => $entry->getAmount(),
                'type' => $entry->getType(),
                'category' => $entry->getCategory(),
                'description' => $entry->getDescription(),
                'entryDate' => $entry->getEntryDate()->format('Y-m-d'),
                'createdByUser' => [
                    'fullName' => $user->getFullName(),
                ],
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * PUT /api/cash-books/{id}/entries/{entryId}
     * Updates an existing entry.
     * Body: {amount?, type?, category?, description?, entryDate?}.
     */
    #[Route('/{id}/entries/{entryId}', name: 'update_entry', methods: ['PUT'])]
    public function updateEntry(int $id, int $entryId, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBook = $this->em->getRepository(CashBook::class)->find($id);
        if (null === $cashBook) {
            return $this->json(['error' => 'Kassenbuch nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canAccessCashBook($user, $cashBook)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $entry = $this->em->getRepository(CashBookEntry::class)->find($entryId);
        if (null === $entry || $entry->getCashBook()->getId() !== $cashBook->getId()) {
            return $this->json(['error' => 'Eintrag nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        // Merge with existing values for validation
        $merged = [
            'amount' => $data['amount'] ?? $entry->getAmount(),
            'type' => $data['type'] ?? $entry->getType(),
            'description' => $data['description'] ?? $entry->getDescription(),
            'entryDate' => $data['entryDate'] ?? $entry->getEntryDate()->format('Y-m-d'),
        ];

        $validationError = $this->validateEntryPayload($merged);
        if (null !== $validationError) {
            return $validationError;
        }

        if (array_key_exists('amount', $data)) {
            $entry->setAmount((float) $data['amount']);
        }
        if (array_key_exists('type', $data)) {
            $entry->setType((string) $data['type']);
        }
        if (array_key_exists('category', $data)) {
            $category = trim((string) ($data['category'] ?? ''));
            $entry->setCategory('' !== $category ? $category : null);
        }
        if (array_key_exists('description', $data)) {
            $entry->setDescription(trim((string) $data['description']));
        }
        if (array_key_exists('entryDate', $data)) {
            $entry->setEntryDate(new DateTimeImmutable((string) $data['entryDate']));
        }

        $this->em->flush();

        return $this->json(['success' => true]);
    }

    /**
     * DELETE /api/cash-books/{id}/entries/{entryId}
     * Deletes an entry.
     */
    #[Route('/{id}/entries/{entryId}', name: 'delete_entry', methods: ['DELETE'])]
    public function deleteEntry(int $id, int $entryId): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBook = $this->em->getRepository(CashBook::class)->find($id);
        if (null === $cashBook) {
            return $this->json(['error' => 'Kassenbuch nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canAccessCashBook($user, $cashBook)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $entry = $this->em->getRepository(CashBookEntry::class)->find($entryId);
        if (null === $entry || $entry->getCashBook()->getId() !== $cashBook->getId()) {
            return $this->json(['error' => 'Eintrag nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $this->em->remove($entry);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    /**
     * PUT /api/cash-books/{id}
     * Updates cash book settings (name, openingBalance).
     * Body: {name?, openingBalance?}.
     */
    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(int $id, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBook = $this->em->getRepository(CashBook::class)->find($id);
        if (null === $cashBook) {
            return $this->json(['error' => 'Kassenbuch nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canAccessCashBook($user, $cashBook)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Ungültige Anfrage.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ('' !== $name) {
                $cashBook->setName($name);
            }
        }

        if (array_key_exists('openingBalance', $data)) {
            $ob = $data['openingBalance'];
            if (is_numeric($ob)) {
                $cashBook->setOpeningBalance((float) $ob);
            }
        }

        $this->em->flush();

        return $this->json(['success' => true]);
    }

    /**
     * GET /api/cash-books/{id}/export
     * Exports all entries as CSV.
     */
    #[Route('/{id}/export', name: 'export', methods: ['GET'])]
    public function export(int $id, CashBookEntryRepository $entryRepository): Response
    {
        /** @var User $user */
        $user = $this->getUser();

        $cashBook = $this->em->getRepository(CashBook::class)->find($id);
        if (null === $cashBook) {
            return $this->json(['error' => 'Kassenbuch nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if (!$this->canAccessCashBook($user, $cashBook)) {
            return $this->json(['error' => 'Zugriff verweigert.'], Response::HTTP_FORBIDDEN);
        }

        $entries = $entryRepository->findByCashBookOrdered($cashBook);
        $entriesAsc = array_reverse($entries);

        $runningBalance = $cashBook->getOpeningBalance();

        $csv = "\xEF\xBB\xBF"; // UTF-8 BOM for Excel
        $csv .= "Datum;Beschreibung;Kategorie;Einnahme;Ausgabe;Kontostand;Erstellt von\n";

        if (0.0 != $cashBook->getOpeningBalance()) {
            $csv .= sprintf(
                "%s;%s;%s;%s;%s;%s;%s\n",
                '',
                'Eröffnungssaldo',
                '',
                $cashBook->getOpeningBalance() > 0 ? number_format($cashBook->getOpeningBalance(), 2, ',', '.') : '',
                $cashBook->getOpeningBalance() < 0 ? number_format(abs($cashBook->getOpeningBalance()), 2, ',', '.') : '',
                number_format($cashBook->getOpeningBalance(), 2, ',', '.'),
                ''
            );
        }

        foreach ($entriesAsc as $entry) {
            if ('income' === $entry->getType()) {
                $runningBalance += $entry->getAmount();
            } else {
                $runningBalance -= $entry->getAmount();
            }

            $csv .= sprintf(
                "%s;%s;%s;%s;%s;%s;%s\n",
                $entry->getEntryDate()->format('d.m.Y'),
                str_replace(';', ',', $entry->getDescription()),
                str_replace(';', ',', $entry->getCategory() ?? ''),
                'income' === $entry->getType() ? number_format($entry->getAmount(), 2, ',', '.') : '',
                'expense' === $entry->getType() ? number_format($entry->getAmount(), 2, ',', '.') : '',
                number_format(round($runningBalance, 2), 2, ',', '.'),
                null !== $entry->getCreatedByUser() ? str_replace(';', ',', $entry->getCreatedByUser()->getFullName()) : ''
            );
        }

        $filename = 'Kassenbuch_' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $cashBook->getName()) . '_' . date('Y-m-d') . '.csv';

        return new Response($csv, Response::HTTP_OK, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Validates a cash book entry payload and returns a JsonResponse on error or null on success.
     *
     * @param array<string, mixed> $data
     */
    private function validateEntryPayload(array $data): ?JsonResponse
    {
        $amount = $data['amount'] ?? null;
        if (null === $amount || !is_numeric($amount) || (float) $amount <= 0) {
            return $this->json(['error' => 'Bitte einen positiven Betrag angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $type = $data['type'] ?? null;
        if (!in_array($type, ['income', 'expense'], true)) {
            return $this->json(['error' => 'Typ muss "income" oder "expense" sein.'], Response::HTTP_BAD_REQUEST);
        }

        $description = trim((string) ($data['description'] ?? ''));
        if ('' === $description) {
            return $this->json(['error' => 'Bitte eine Beschreibung angeben.'], Response::HTTP_BAD_REQUEST);
        }

        $entryDate = $data['entryDate'] ?? null;
        if (!is_string($entryDate) || '' === trim($entryDate)) {
            return $this->json(['error' => 'Bitte ein gültiges Datum angeben.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            new DateTimeImmutable($entryDate);
        } catch (Exception) {
            return $this->json(['error' => 'Das Datum ist ungültig.'], Response::HTTP_BAD_REQUEST);
        }

        return null;
    }
}
