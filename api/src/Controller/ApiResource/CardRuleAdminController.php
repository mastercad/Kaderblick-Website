<?php

declare(strict_types=1);

namespace App\Controller\ApiResource;

use App\Entity\CompetitionCardRule;
use App\Repository\CompetitionCardRuleRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * CRUD-Endpunkte für Karten-Sperr-Regeln (Admin).
 *
 * GET    /api/admin/card-rules            Alle Regeln auflisten
 * POST   /api/admin/card-rules            Neue Regel anlegen
 * PATCH  /api/admin/card-rules/{id}       Regel aktualisieren
 * DELETE /api/admin/card-rules/{id}       Regel löschen
 */
#[Route('/api/admin/card-rules', name: 'api_admin_card_rules_')]
class CardRuleAdminController extends AbstractController
{
    public function __construct(
        private readonly CompetitionCardRuleRepository $repository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    // ── GET /api/admin/card-rules ─────────────────────────────────────────────

    #[Route('', name: 'index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $type = $request->query->get('competitionType');
        $rules = $this->repository->findAllForAdmin(
            is_string($type) && '' !== $type ? $type : null,
        );

        return $this->json(array_map(fn (CompetitionCardRule $r) => $r->toArray(), $rules));
    }

    // ── POST /api/admin/card-rules ────────────────────────────────────────────

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $body = $this->parseBody($request);
        if (null === $body) {
            return $this->json(['error' => 'Invalid JSON'], Response::HTTP_BAD_REQUEST);
        }

        $validationError = $this->validateBody($body);
        if (null !== $validationError) {
            return $this->json(['error' => $validationError], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $rule = new CompetitionCardRule(
            competitionType: $body['competitionType'],
            competitionId: isset($body['competitionId']) ? (int) $body['competitionId'] : null,
            yellowWarningThreshold: (int) ($body['yellowWarningThreshold'] ?? 4),
            yellowSuspensionThreshold: (int) ($body['yellowSuspensionThreshold'] ?? 5),
            suspensionGames: (int) ($body['suspensionGames'] ?? 1),
            redCardSuspensionGames: (int) ($body['redCardSuspensionGames'] ?? 1),
            yellowRedCardSuspensionGames: (int) ($body['yellowRedCardSuspensionGames'] ?? 1),
            personType: (string) ($body['personType'] ?? CompetitionCardRule::PERSON_ALL),
            resetAfterSuspension: (bool) ($body['resetAfterSuspension'] ?? true),
            validFrom: $this->parseDate($body['validFrom'] ?? null),
            validUntil: $this->parseDate($body['validUntil'] ?? null),
        );

        $this->em->persist($rule);
        $this->em->flush();

        return $this->json($rule->toArray(), Response::HTTP_CREATED);
    }

    // ── PATCH /api/admin/card-rules/{id} ─────────────────────────────────────

    #[Route('/{id}', name: 'update', methods: ['PATCH'])]
    public function update(CompetitionCardRule $rule, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $body = $this->parseBody($request);
        if (null === $body) {
            return $this->json(['error' => 'Invalid JSON'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('competitionType', $body)) {
            $type = trim((string) $body['competitionType']);
            if (!in_array($type, CompetitionCardRule::ALLOWED_TYPES, true)) {
                return $this->json(['error' => 'Ungültiger Wettbewerbstyp'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $rule->setCompetitionType($type);
        }
        if (array_key_exists('competitionId', $body)) {
            $rule->setCompetitionId(null !== $body['competitionId'] ? (int) $body['competitionId'] : null);
        }
        if (array_key_exists('yellowWarningThreshold', $body)) {
            $rule->setYellowWarningThreshold((int) $body['yellowWarningThreshold']);
        }
        if (array_key_exists('yellowSuspensionThreshold', $body)) {
            $rule->setYellowSuspensionThreshold((int) $body['yellowSuspensionThreshold']);
        }
        if (array_key_exists('suspensionGames', $body)) {
            $rule->setSuspensionGames((int) $body['suspensionGames']);
        }
        if (array_key_exists('redCardSuspensionGames', $body)) {
            $rule->setRedCardSuspensionGames((int) $body['redCardSuspensionGames']);
        }
        if (array_key_exists('yellowRedCardSuspensionGames', $body)) {
            $rule->setYellowRedCardSuspensionGames((int) $body['yellowRedCardSuspensionGames']);
        }
        if (array_key_exists('personType', $body)) {
            $pType = (string) $body['personType'];
            if (!in_array($pType, CompetitionCardRule::ALLOWED_PERSON_TYPES, true)) {
                return $this->json(['error' => 'Ungültiger personType'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $rule->setPersonType($pType);
        }
        if (array_key_exists('resetAfterSuspension', $body)) {
            $rule->setResetAfterSuspension((bool) $body['resetAfterSuspension']);
        }
        if (array_key_exists('validFrom', $body)) {
            $rule->setValidFrom($this->parseDate($body['validFrom']));
        }
        if (array_key_exists('validUntil', $body)) {
            $rule->setValidUntil($this->parseDate($body['validUntil']));
        }

        $this->em->flush();

        return $this->json($rule->toArray());
    }

    // ── DELETE /api/admin/card-rules/{id} ────────────────────────────────────

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(CompetitionCardRule $rule): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $this->em->remove($rule);
        $this->em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return array<string, mixed>|null */
    private function parseBody(Request $request): ?array
    {
        $decoded = json_decode($request->getContent(), true);

        return is_array($decoded) ? $decoded : null;
    }

    /** @param array<string, mixed> $body */
    private function validateBody(array $body): ?string
    {
        $type = trim((string) ($body['competitionType'] ?? ''));
        if ('' === $type) {
            return 'competitionType ist erforderlich';
        }
        if (!in_array($type, CompetitionCardRule::ALLOWED_TYPES, true)) {
            return 'Ungültiger competitionType. Erlaubt: ' . implode(', ', CompetitionCardRule::ALLOWED_TYPES);
        }

        $personType = (string) ($body['personType'] ?? CompetitionCardRule::PERSON_ALL);
        if (!in_array($personType, CompetitionCardRule::ALLOWED_PERSON_TYPES, true)) {
            return 'Ungültiger personType. Erlaubt: ' . implode(', ', CompetitionCardRule::ALLOWED_PERSON_TYPES);
        }

        $warning = (int) ($body['yellowWarningThreshold'] ?? 4);
        $suspension = (int) ($body['yellowSuspensionThreshold'] ?? 5);
        if ($warning > $suspension && $suspension > 0) {
            return 'yellowWarningThreshold darf nicht größer sein als yellowSuspensionThreshold';
        }

        return null;
    }

    private function parseDate(mixed $value): ?DateTimeImmutable
    {
        if (null === $value || '' === $value) {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('Y-m-d', (string) $value);

        return $date instanceof DateTimeImmutable ? $date->setTime(0, 0) : null;
    }
}
