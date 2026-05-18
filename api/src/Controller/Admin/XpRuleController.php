<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\XpRule;
use App\Repository\XpRuleRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/superadmin/xp-rules')]
#[IsGranted('ROLE_SUPERADMIN')]
class XpRuleController extends AbstractController
{
    private const ALLOWED_CATEGORIES = [
        XpRule::CATEGORY_SPORT,
        XpRule::CATEGORY_PLATFORM,
        XpRule::CATEGORY_GAME_EVENT,
    ];

    public function __construct(
        private XpRuleRepository $xpRuleRepository,
        private EntityManagerInterface $em,
    ) {
    }

    // ── GET /api/superadmin/xp-rules ─────────────────────────────────────────
    #[Route('', name: 'api_superadmin_xp_rules_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $rules = $this->xpRuleRepository->findAllOrdered();

        return $this->json([
            'rules' => array_map([$this, 'serialize'], $rules),
            'categories' => self::ALLOWED_CATEGORIES,
        ]);
    }

    // ── POST /api/superadmin/xp-rules ────────────────────────────────────────
    #[Route('', name: 'api_superadmin_xp_rules_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        if (empty($data['actionType']) || empty($data['label']) || !isset($data['xpValue'])) {
            return $this->json(['error' => 'Pflichtfelder: actionType, label, xpValue'], Response::HTTP_BAD_REQUEST);
        }

        // Prevent duplicates
        if ($this->xpRuleRepository->findByActionType((string) $data['actionType'])) {
            return $this->json(['error' => sprintf('actionType "%s" existiert bereits.', $data['actionType'])], Response::HTTP_CONFLICT);
        }

        $rule = new XpRule();
        $rule->setActionType((string) $data['actionType']);
        $this->applyWritableFields($rule, $data);
        $rule->setCreatedAt(new DateTimeImmutable());
        $rule->setUpdatedAt(new DateTimeImmutable());

        $this->em->persist($rule);
        $this->em->flush();

        return $this->json(['rule' => $this->serialize($rule)], Response::HTTP_CREATED);
    }

    // ── PATCH /api/superadmin/xp-rules/{id} ──────────────────────────────────
    #[Route('/{id}', name: 'api_superadmin_xp_rules_update', methods: ['PATCH'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $rule = $this->xpRuleRepository->find($id);
        if (!$rule) {
            return $this->json(['error' => 'Regel nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $this->applyWritableFields($rule, $data);
        $rule->setUpdatedAt(new DateTimeImmutable());

        $this->em->flush();

        return $this->json(['rule' => $this->serialize($rule)]);
    }

    // ── DELETE /api/superadmin/xp-rules/{id} ─────────────────────────────────
    #[Route('/{id}', name: 'api_superadmin_xp_rules_delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $rule = $this->xpRuleRepository->find($id);
        if (!$rule) {
            return $this->json(['error' => 'Regel nicht gefunden.'], Response::HTTP_NOT_FOUND);
        }

        if ($rule->isSystem()) {
            return $this->json(['error' => 'Systemregeln können nicht gelöscht werden.'], Response::HTTP_FORBIDDEN);
        }

        $this->em->remove($rule);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    // ── POST /api/superadmin/xp-rules/seed-defaults ──────────────────────────
    // Resets all system rules to their default XP values (does NOT delete custom rules).
    #[Route('/seed-defaults', name: 'api_superadmin_xp_rules_seed_defaults', methods: ['POST'])]
    public function seedDefaults(): JsonResponse
    {
        $defaults = $this->getDefaultRules();
        $changed = 0;

        foreach ($defaults as $actionType => $def) {
            $rule = $this->xpRuleRepository->findByActionType($actionType);
            if (!$rule) {
                $rule = new XpRule();
                $rule->setActionType($actionType);
                $rule->setCreatedAt(new DateTimeImmutable());
                $rule->setIsSystem(true);
                $this->em->persist($rule);
            }

            $rule->setLabel($def['label']);
            $rule->setCategory($def['category']);
            $rule->setDescription($def['description'] ?? null);
            $rule->setXpValue($def['xpValue']);
            $rule->setEnabled(true);
            $rule->setCooldownMinutes($def['cooldownMinutes'] ?? 0);
            $rule->setDailyLimit($def['dailyLimit'] ?? null);
            $rule->setMonthlyLimit($def['monthlyLimit'] ?? null);
            $rule->setUpdatedAt(new DateTimeImmutable());
            ++$changed;
        }

        $this->em->flush();

        return $this->json(['reset' => $changed]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * @param array<string, mixed> $data
     */
    private function applyWritableFields(XpRule $rule, array $data): void
    {
        if (array_key_exists('label', $data)) {
            $rule->setLabel((string) $data['label']);
        }

        if (array_key_exists('category', $data) && in_array($data['category'], self::ALLOWED_CATEGORIES, true)) {
            $rule->setCategory((string) $data['category']);
        }

        if (array_key_exists('description', $data)) {
            $rule->setDescription('' !== $data['description'] ? (string) $data['description'] : null);
        }

        if (array_key_exists('xpValue', $data)) {
            $rule->setXpValue((int) $data['xpValue']);
        }

        if (array_key_exists('enabled', $data)) {
            $rule->setEnabled((bool) $data['enabled']);
        }

        if (array_key_exists('cooldownMinutes', $data)) {
            $rule->setCooldownMinutes((int) $data['cooldownMinutes']);
        }

        if (array_key_exists('dailyLimit', $data)) {
            $rule->setDailyLimit(null !== $data['dailyLimit'] ? (int) $data['dailyLimit'] : null);
        }

        if (array_key_exists('monthlyLimit', $data)) {
            $rule->setMonthlyLimit(null !== $data['monthlyLimit'] ? (int) $data['monthlyLimit'] : null);
        }
    }

    /** @return array<string, mixed> */
    private function serialize(XpRule $rule): array
    {
        return [
            'id' => $rule->getId(),
            'actionType' => $rule->getActionType(),
            'label' => $rule->getLabel(),
            'category' => $rule->getCategory(),
            'description' => $rule->getDescription(),
            'xpValue' => $rule->getXpValue(),
            'enabled' => $rule->isEnabled(),
            'isSystem' => $rule->isSystem(),
            'cooldownMinutes' => $rule->getCooldownMinutes(),
            'dailyLimit' => $rule->getDailyLimit(),
            'monthlyLimit' => $rule->getMonthlyLimit(),
            'updatedAt' => $rule->getUpdatedAt()->format('c'),
        ];
    }

    /**
     * Default XP rules (mirrors the migration seed data).
     *
     * @return array<string, array<string, mixed>>
     */
    private function getDefaultRules(): array
    {
        return [
            // ── Platform ────────────────────────────────────────────────────
            'daily_login' => ['label' => 'Täglicher Login',              'category' => 'platform', 'xpValue' => 5,   'cooldownMinutes' => -1, 'dailyLimit' => 1],
            'profile_update' => ['label' => 'Profil aktualisiert',           'category' => 'platform', 'xpValue' => 5,   'cooldownMinutes' => 1440, 'dailyLimit' => 1],
            'profile_completion_25' => ['label' => 'Profilvollständigkeit 25 %',   'category' => 'platform', 'xpValue' => 25,  'cooldownMinutes' => 0],
            'profile_completion_50' => ['label' => 'Profilvollständigkeit 50 %',   'category' => 'platform', 'xpValue' => 50,  'cooldownMinutes' => 0],
            'profile_completion_75' => ['label' => 'Profilvollständigkeit 75 %',   'category' => 'platform', 'xpValue' => 75,  'cooldownMinutes' => 0],
            'profile_completion_100' => ['label' => 'Profilvollständigkeit 100 %',  'category' => 'platform', 'xpValue' => 100, 'cooldownMinutes' => 0],
            'survey_completed' => ['label' => 'Umfrage ausgefüllt',            'category' => 'platform', 'xpValue' => 10,  'cooldownMinutes' => 0],
            'task_completed' => ['label' => 'Aufgabe erledigt',              'category' => 'platform', 'xpValue' => 8,   'cooldownMinutes' => 0, 'monthlyLimit' => 10],
            // ── Sport ───────────────────────────────────────────────────────
            'calendar_event' => ['label' => 'Kalender-Teilnahme bestätigt', 'category' => 'sport',    'xpValue' => 10,  'cooldownMinutes' => 0],
            'calendar_event_created' => ['label' => 'Kalender-Event angelegt',       'category' => 'sport',    'xpValue' => 5,   'cooldownMinutes' => 0],
            'training_attended' => ['label' => 'Training besucht',              'category' => 'sport',    'xpValue' => 15,  'cooldownMinutes' => 0],
            'match_attended' => ['label' => 'Spiel bestritten',              'category' => 'sport',    'xpValue' => 20,  'cooldownMinutes' => 0],
            'participation_response' => ['label' => 'Teilnahme beantwortet',       'category' => 'sport',    'xpValue' => 5,   'cooldownMinutes' => 0],
            'carpool_offered' => ['label' => 'Fahrgemeinschaft angeboten',    'category' => 'sport',    'xpValue' => 5,   'cooldownMinutes' => 0, 'monthlyLimit' => 8],
            'game_event' => ['label' => 'Spielereignis hinterlegt', 'category' => 'sport', 'xpValue' => 15, 'cooldownMinutes' => 0],
            'game_event_updated' => ['label' => 'Spielereignis angepasst',       'category' => 'sport',    'xpValue' => 5,   'cooldownMinutes' => 1440, 'monthlyLimit' => 5],
        ];
    }
}
