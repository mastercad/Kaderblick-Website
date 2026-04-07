<?php

namespace App\Controller\Api;

use App\Entity\ReportDefinition;
use App\Entity\User;
use App\Security\Voter\ReportVoter;
use App\Service\CoachTeamPlayerService;
use App\Service\ReportDataService;
use App\Service\ReportFieldAliasService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/report')]
#[IsGranted('ROLE_USER')]
class ReportController extends AbstractController
{
    public function __construct(
        private readonly CoachTeamPlayerService $coachTeamPlayerService,
    ) {
    }

    #[Route('/builder-data', name: 'api_report_builder_data', methods: ['GET'])]
    public function builderData(EntityManagerInterface $em): JsonResponse
    {
        $fieldAliases = ReportFieldAliasService::fieldAliases($em);

        // Only teams that have actual game events (avoids loading all 900+ teams)
        $teams = $em->createQuery(
            'SELECT DISTINCT t FROM App\Entity\Team t INNER JOIN t.gameEvents ge ORDER BY t.name ASC'
        )->getResult();

        $eventTypes = $em->getRepository(\App\Entity\GameEventType::class)->findAll();

        $teamsData = array_map(fn ($team) => [
            'id' => $team->getId(),
            'name' => $team->getName()
        ], $teams);

        $eventTypesData = array_map(fn ($eventType) => [
            'id' => $eventType->getId(),
            'name' => $eventType->getName()
        ], $eventTypes);

        // Surface types for filter
        $surfaceTypeRepo = $em->getRepository(\App\Entity\SurfaceType::class);
        $surfaceTypes = $surfaceTypeRepo->findAll();
        $surfaceTypesData = array_map(fn ($s) => [
            'id' => $s->getId(),
            'name' => $s->getName()
        ], $surfaceTypes);

        // Game types for filter
        $gameTypeRepo = $em->getRepository(\App\Entity\GameType::class);
        $gameTypes = $gameTypeRepo->findAll();
        $gameTypesData = array_map(fn ($gt) => [
            'id' => $gt->getId(),
            'name' => $gt->getName()
        ], $gameTypes);

        // Available dates from events: single efficient DISTINCT DATE() query via DBAL
        $availableDates = $em->getConnection()->fetchFirstColumn(
            'SELECT DISTINCT DATE(timestamp) AS d FROM game_events ORDER BY d ASC'
        );
        $minDate = $availableDates[0] ?? null;
        $maxDate = $availableDates[count($availableDates) - 1] ?? null;

        // Separate aliases into dimensions and metrics for the frontend
        $dimensions = [];
        $metrics = [];
        foreach ($fieldAliases as $key => $data) {
            $category = $data['category'] ?? 'dimension';
            $item = [
                'key' => $key,
                'label' => $data['label'],
                'source' => $data['entity'] ?? 'GameEvent',
                'dataType' => $data['type'] ?? 'numeric',
                'isMetricCandidate' => isset($data['aggregate']) && is_callable($data['aggregate']),
            ];

            if ('metric' === $category) {
                $metrics[] = $item;
            } else {
                $dimensions[] = $item;
            }
        }

        // Fields = dimensions (for X-Axis, GroupBy) + metrics (for Y-Axis)
        // Both are shown to the user as selectable options
        $fields = array_merge($dimensions, $metrics);

        // Metric tokens for radar charts
        $radarMetrics = [];
        foreach ($fieldAliases as $key => $data) {
            if (isset($data['aggregate']) && is_callable($data['aggregate'])) {
                $radarMetrics[] = [
                    'key' => $key,
                    'label' => $data['label'],
                ];
            }
        }

        // Weather metric for radar
        $radarMetrics[] = [
            'key' => 'weather:precipitation',
            'label' => 'Regen / Niederschlag (Spieltag)',
        ];

        // Surface type metrics for radar (per surface type)
        foreach ($surfaceTypes as $st) {
            $radarMetrics[] = [
                'key' => 'surfaceType:' . $st->getId(),
                'label' => $st->getName() . ' (Spielfeld)',
            ];
        }

        // Presets: common report templates for non-technical users
        $presets = $this->buildPresets();

        $response = $this->json([
            'fields' => $fields,
            'advancedFields' => [],
            'presets' => $presets,
            'teams' => $teamsData,
            'eventTypes' => $eventTypesData,
            'surfaceTypes' => $surfaceTypesData,
            'gameTypes' => $gameTypesData,
            'metrics' => $radarMetrics,
            'availableDates' => $availableDates,
            'minDate' => $minDate,
            'maxDate' => $maxDate,
        ]);
        // Cache for 5 minutes — event types, teams and dates change rarely
        $response->setMaxAge(300)->setPrivate();

        return $response;
    }

    /**
     * Lightweight player autocomplete for the report builder filter.
     * Returns up to 20 players whose first or last name contains the search term.
     */
    #[Route('/player-search', name: 'api_report_player_search', methods: ['GET'])]
    public function playerSearch(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $q = trim((string) $request->query->get('q', ''));
        if (mb_strlen($q) < 2) {
            return $this->json([]);
        }

        $players = $em->createQuery(
            'SELECT p FROM App\Entity\Player p
             WHERE LOWER(p.firstName) LIKE :q OR LOWER(p.lastName) LIKE :q
             ORDER BY p.lastName ASC, p.firstName ASC'
        )
            ->setParameter('q', '%' . mb_strtolower($q) . '%')
            ->setMaxResults(20)
            ->getResult();

        return $this->json(array_map(static function ($p) {
            $firstAssignment = $p->getPlayerTeamAssignments()->first();

            return [
                'id' => $p->getId(),
                'fullName' => $p->getFullName(),
                'firstName' => $p->getFirstName(),
                'lastName' => $p->getLastName(),
                'teamName' => false !== $firstAssignment ? $firstAssignment->getTeam()->getName() : null,
            ];
        }, $players));
    }

    #[Route('/preview', name: 'api_report_preview', methods: ['POST'])]
    public function preview(Request $request, ReportDataService $reportDataService): JsonResponse
    {
        $content = $request->getContent();
        $config = json_decode($content, true);

        if (JSON_ERROR_NONE !== json_last_error() || !is_array($config)) {
            return $this->json(['error' => 'Invalid JSON configuration: ' . json_last_error_msg()], 400);
        }

        // Clean filters - remove empty values
        $configData = $config['config'] ?? $config;
        $rawFilters = $configData['filters'] ?? [];

        // Convert stdClass to array if needed
        if (is_object($rawFilters)) {
            $rawFilters = (array) $rawFilters;
        }

        $filters = [];
        foreach ($rawFilters as $k => $v) {
            if (null !== $v && '' !== $v) {
                $filters[$k] = $v;
            }
        }
        $configData['filters'] = $filters;

        $reportData = $reportDataService->generateReportData($configData);

        $response = [
            'labels' => $reportData['labels'],
            'datasets' => $reportData['datasets'],
            'diagramType' => $configData['diagramType'] ?? 'bar',
            'meta' => $reportData['meta'] ?? null,
        ];

        // For faceted charts, include the panels array and sub-type
        if (isset($reportData['panels'])) {
            $response['panels'] = $reportData['panels'];
        }
        if (isset($reportData['facetSubType'])) {
            $response['facetSubType'] = $reportData['facetSubType'];
        }
        if (isset($reportData['facetLayout'])) {
            $response['facetLayout'] = $reportData['facetLayout'];
        }

        return $this->json($response);
    }

    #[Route('/available', name: 'api_report_available', methods: ['GET'])]
    public function available(EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $repo = $em->getRepository(ReportDefinition::class);
        $templates = $repo->findBy(['isTemplate' => true]);
        $userReports = $repo->findBy(['user' => $user]);
        $result = [];
        foreach ($templates as $report) {
            $result[] = [
                'id' => $report->getId(),
                'name' => $report->getName(),
                'isTemplate' => true
            ];
        }
        foreach ($userReports as $report) {
            $result[] = [
                'id' => $report->getId(),
                'name' => $report->getName(),
                'isTemplate' => false
            ];
        }

        return $this->json($result);
    }

    #[Route('/widget/{reportId}/data', name: 'api_report_data', methods: ['GET'])]
    public function retrieveData(int $reportId, EntityManagerInterface $em, Request $request, ReportDataService $reportDataService): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $report = $em->getRepository(ReportDefinition::class)->find($reportId);
        if (!$report || ($report->getUser() !== $user && false == $report->isTemplate())) {
            return $this->json(['error' => 'Report not found or access denied', 'owner' => $report->getUser()->getId(), 'user' => $user->getId()], 404);
        }
        $config = $report->getConfig();
        $rawFilters = $config['filters'] ?? [];

        $filters = [];
        foreach ($rawFilters as $k => $v) {
            if (null !== $v && '' !== $v) {
                $filters[$k] = $v;
            }
        }
        $diagramType = $config['diagramType'] ?? 'bar';
        $config['filters'] = $filters;

        $reportData = $reportDataService->generateReportData($config);

        $response = [
            'name' => $report->getName(),
            'description' => $report->getDescription(),
            'config' => $config,
            'labels' => $reportData['labels'],
            'datasets' => $reportData['datasets'],
            'diagramType' => $diagramType,
            'meta' => $reportData['meta'] ?? null,
        ];

        // For faceted charts, include the panels array and sub-type
        if (isset($reportData['panels'])) {
            $response['panels'] = $reportData['panels'];
        }
        if (isset($reportData['facetSubType'])) {
            $response['facetSubType'] = $reportData['facetSubType'];
        }
        if (isset($reportData['facetLayout'])) {
            $response['facetLayout'] = $reportData['facetLayout'];
        }

        return $this->json($response);
    }

    #[Route('/definitions', name: 'api_report_definitions', methods: ['GET'])]
    public function list(EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $repo = $em->getRepository(ReportDefinition::class);
        $templates = $repo->findBy(['isTemplate' => true]);
        $userReports = $repo->findBy(['user' => $user]);

        $templates = array_filter($templates, fn ($r) => $this->isGranted(ReportVoter::VIEW, $r));
        $userReports = array_filter($userReports, fn ($r) => $this->isGranted(ReportVoter::VIEW, $r));

        // Convert to simple arrays to avoid circular references
        $templatesData = array_map(fn ($report) => [
            'id' => $report->getId(),
            'name' => $report->getName(),
            'description' => $report->getDescription(),
            'config' => $report->getConfig(),
            'isTemplate' => $report->isTemplate()
        ], $templates);

        $userReportsData = array_map(fn ($report) => [
            'id' => $report->getId(),
            'name' => $report->getName(),
            'description' => $report->getDescription(),
            'config' => $report->getConfig(),
            'isTemplate' => $report->isTemplate()
        ], $userReports);

        return $this->json([
            'templates' => $templatesData,
            'userReports' => $userReportsData
        ]);
    }

    #[Route('/definition/{id}', name: 'api_report_get', methods: ['GET'])]
    public function getDefinition(int $id, EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $report = $em->getRepository(ReportDefinition::class)->find($id);
        if (!$report) {
            return $this->json(['error' => 'Report not found'], 404);
        }
        // Allow access to own reports and templates
        if (!$report->isTemplate() && $report->getUser()?->getId() !== $user->getId()) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        return $this->json([
            'id' => $report->getId(),
            'name' => $report->getName(),
            'description' => $report->getDescription(),
            'config' => $report->getConfig(),
            'isTemplate' => $report->isTemplate(),
        ]);
    }

    #[Route('/definition', name: 'api_report_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): JsonResponse
    {
        // Reports können von authentifizierten Benutzern erstellt werden
        $this->denyAccessUnlessGranted('IS_AUTHENTICATED_FULLY');

        $data = json_decode($request->getContent(), true);
        if (!isset($data['name'], $data['config'])) {
            return $this->json(['error' => 'Missing name or config'], 400);
        }
        // validate metrics tokens in config
        $allowed = [];
        $aliases = ReportFieldAliasService::fieldAliases($em);
        foreach ($aliases as $k => $v) {
            if (isset($v['aggregate']) && is_callable($v['aggregate'])) {
                $allowed[] = $k;
            }
        }
        $eventTypes = $em->getRepository(\App\Entity\GameEventType::class)->findAll();
        foreach ($eventTypes as $et) {
            $allowed[] = 'eventType:' . $et->getId();
        }
        $surfaceTypes = $em->getRepository(\App\Entity\SurfaceType::class)->findAll();
        foreach ($surfaceTypes as $st) {
            $allowed[] = 'surfaceType:' . $st->getId();
        }
        $allowed[] = 'weather:precipitation';

        if (isset($data['config']['metrics']) && is_array($data['config']['metrics'])) {
            foreach ($data['config']['metrics'] as $m) {
                if (!in_array($m, $allowed, true)) {
                    return $this->json(['error' => 'Invalid metric token: ' . $m], 400);
                }
            }
        }
        /** @var User $user */
        $user = $this->getUser();
        $report = new ReportDefinition();
        $report->setName($data['name']);
        $report->setDescription($data['description'] ?? null);
        $report->setConfig($data['config']);
        if (
            !empty($data['isTemplate'])
            && (in_array('ROLE_ADMIN', $user->getRoles()) || in_array('ROLE_SUPERADMIN', $user->getRoles()))
        ) {
            $report->setIsTemplate(true);
            $report->setUser(null);
        } else {
            $report->setIsTemplate(false);
            $report->setUser($user);
        }
        $em->persist($report);
        $em->flush();

        return $this->json(['status' => 'success', 'id' => $report->getId()]);
    }

    #[Route('/definition/{id}', name: 'api_report_update', methods: ['PUT'])]
    public function update(ReportDefinition $report, Request $request, EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        if ($report->getUser()?->getId() !== $user->getId() && true !== $report->isTemplate()) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        $data = json_decode($request->getContent(), true);
        // validate metrics tokens in config if provided
        if (isset($data['config']) && is_array($data['config']) && isset($data['config']['metrics']) && is_array($data['config']['metrics'])) {
            $allowed = [];
            $aliases = ReportFieldAliasService::fieldAliases($em);
            foreach ($aliases as $k => $v) {
                if (isset($v['aggregate']) && is_callable($v['aggregate'])) {
                    $allowed[] = $k;
                }
            }
            $eventTypes = $em->getRepository(\App\Entity\GameEventType::class)->findAll();
            foreach ($eventTypes as $et) {
                $allowed[] = 'eventType:' . $et->getId();
            }
            $surfaceTypes = $em->getRepository(\App\Entity\SurfaceType::class)->findAll();
            foreach ($surfaceTypes as $st) {
                $allowed[] = 'surfaceType:' . $st->getId();
            }
            $allowed[] = 'weather:precipitation';

            foreach ($data['config']['metrics'] as $m) {
                if (!in_array($m, $allowed, true)) {
                    return $this->json(['error' => 'Invalid metric token: ' . $m], 400);
                }
            }
        }
        if (isset($data['name'])) {
            $report->setName($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $report->setDescription($data['description']);
        }
        if (isset($data['config'])) {
            $report->setConfig($data['config']);
        }

        if (true === $report->isTemplate()) {
            if (
                !in_array('ROLE_ADMIN', $user->getRoles())
                && !in_array('ROLE_SUPERADMIN', $user->getRoles())
            ) {
                $newReport = new ReportDefinition();
                $newReport->setName($data['name'] ?? $report->getName());
                $newReport->setDescription($data['description'] ?? $report->getDescription());
                $newReport->setConfig($data['config'] ?? $report->getConfig());
                $newReport->setUser($user);
                $newReport->setIsTemplate(false);
                $newReport->setCreatedAt(new DateTimeImmutable());
                $newReport->setUpdatedAt(new DateTimeImmutable());

                $em->persist($newReport);
                $em->detach($report);
                $em->flush();

                return $this->json(['status' => 'success', 'id' => $newReport->getId()]);
            }
            // Admin/SuperAdmin: update in-place.
            // Also allow demoting the template back to a regular report.
            if (isset($data['isTemplate']) && false === (bool) $data['isTemplate']) {
                $report->setIsTemplate(false);
                $report->setUser($user);
            }
            $report->setUpdatedAt(new DateTimeImmutable());
            $em->flush();
        } else {
            // Allow Admin/SuperAdmin to promote/demote isTemplate on their own report
            if (
                isset($data['isTemplate'])
                && (
                    in_array('ROLE_ADMIN', $user->getRoles())
                    || in_array('ROLE_SUPERADMIN', $user->getRoles())
                )
            ) {
                $report->setIsTemplate((bool) $data['isTemplate']);
                if ((bool) $data['isTemplate']) {
                    $report->setUser(null);
                } else {
                    $report->setUser($user);
                }
            }
            $report->setUpdatedAt(new DateTimeImmutable());
            $em->flush();
        }

        return $this->json(['status' => 'success']);
    }

    #[Route('/definition/{id}', name: 'api_report_delete', methods: ['DELETE'])]
    public function delete(ReportDefinition $report, EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        if ($report->getUser()?->getId() !== $user->getId()) {
            return $this->json(['error' => 'Access denied'], 403);
        }

        // Zugehörige Dashboard-Widgets entfernen, damit keine verwaisten Einträge bleiben
        foreach ($report->getWidgets() as $widget) {
            $em->remove($widget);
        }

        $em->remove($report);
        $em->flush();

        return $this->json(['status' => 'success']);
    }

    /**
     * Lightweight endpoint: returns only the preset list (no heavy field/date queries).
     * Used by the ReportsOverview page on initial load instead of the full builder-data call.
     */
    #[Route('/presets', name: 'api_report_presets', methods: ['GET'])]
    public function presets(): JsonResponse
    {
        return $this->json(['presets' => $this->buildPresets()]);
    }

    /**
     * Lightweight endpoint: returns only teams and players for the context-selection modal.
     * Loaded lazily – only when the user actually clicks "Übernehmen" on a preset/template
     * that involves a team or player dimension.
     */
    #[Route('/context-data', name: 'api_report_context_data', methods: ['GET'])]
    public function contextData(EntityManagerInterface $em): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $isSuperAdmin = in_array('ROLE_SUPERADMIN', $user->getRoles(), true);
        $isAdmin = in_array('ROLE_ADMIN', $user->getRoles(), true);

        if ($isSuperAdmin || $isAdmin) {
            // Admins: only teams that have actual game events
            $allTeams = $em->createQuery(
                'SELECT DISTINCT t FROM App\Entity\Team t INNER JOIN t.gameEvents ge ORDER BY t.name ASC'
            )->getResult();
            // Players: only those who actually appear in game events
            $allPlayers = $em->createQuery(
                'SELECT DISTINCT p FROM App\Entity\Player p INNER JOIN p.gameEvents ge ORDER BY p.lastName ASC, p.firstName ASC'
            )->getResult();

            return $this->json([
                'teams' => array_map(fn ($t) => ['id' => $t->getId(), 'name' => $t->getName()], $allTeams),
                'players' => array_map(fn ($p) => ['id' => $p->getId(), 'fullName' => $p->getFullName()], $allPlayers),
            ]);
        }

        // Normale Nutzer: nur ihre aktuell aktiven Zuordnungen (Spieler- und Coach-Beziehungen)
        // werden über den CoachTeamPlayerService korrekt ausgewertet.
        $coachTeams = $this->coachTeamPlayerService->collectCoachTeams($user);
        $playerTeams = $this->coachTeamPlayerService->collectPlayerTeams($user);

        // Zusammenführen, nach Team-ID deduplizieren
        $teamMap = $coachTeams + $playerTeams;

        // Spieler aus allen zugänglichen Teams sammeln (ebenfalls dedupliziert)
        $playerMap = [];
        foreach ($teamMap as $team) {
            foreach ($this->coachTeamPlayerService->collectTeamPlayers($team) as $entry) {
                $pid = $entry['player']['id'];
                if (null !== $pid && !isset($playerMap[$pid])) {
                    $playerMap[$pid] = ['id' => $pid, 'fullName' => $entry['player']['name']];
                }
            }
        }

        return $this->json([
            'teams' => array_values(array_map(fn ($t) => ['id' => $t->getId(), 'name' => $t->getName()], $teamMap)),
            'players' => array_values($playerMap),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** @return array<int, array<string, mixed>> */
    private function buildPresets(): array
    {
        return [
            [
                'key' => 'goals_per_player',
                'label' => 'Tore pro Spieler',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'player',
                    'yField' => 'goals',
                    'groupBy' => ['player'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'goals_per_team',
                'label' => 'Tore pro Mannschaft',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'team',
                    'yField' => 'goals',
                    'groupBy' => ['team'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'assists_per_player',
                'label' => 'Torvorlagen pro Spieler',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'player',
                    'yField' => 'assists',
                    'groupBy' => ['player'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'cards_per_player',
                'label' => 'Karten pro Spieler',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'player',
                    'yField' => 'yellowCards',
                    'groupBy' => ['player'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'goals_home_away',
                'label' => 'Tore: Heim vs. Auswärts',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'homeAway',
                    'yField' => 'goals',
                    'groupBy' => ['homeAway'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'goals_per_position',
                'label' => 'Tore nach Position',
                'config' => [
                    'diagramType' => 'pie',
                    'xField' => 'position',
                    'yField' => 'goals',
                    'groupBy' => ['position'],
                    'showLegend' => true,
                ],
            ],
            [
                'key' => 'goals_per_month',
                'label' => 'Tore pro Monat',
                'config' => [
                    'diagramType' => 'line',
                    'xField' => 'month',
                    'yField' => 'goals',
                    'groupBy' => ['month'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'events_per_type',
                'label' => 'Ereignisse pro Typ',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'eventType',
                    'yField' => 'eventType',
                    'groupBy' => ['eventType'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'goals_per_game_type',
                'label' => 'Tore nach Spieltyp',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'gameType',
                    'yField' => 'goals',
                    'groupBy' => ['gameType'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'player_radar',
                'label' => 'Spieler-Profil (Radar)',
                'config' => [
                    'diagramType' => 'radar',
                    'xField' => 'player',
                    'yField' => 'goals',
                    'groupBy' => ['player'],
                    'metrics' => ['goals', 'assists', 'shots', 'dribbles', 'duelsWonPercent', 'passes'],
                    'radarNormalize' => true,
                    'showLegend' => true,
                ],
            ],
            [
                'key' => 'performance_by_surface',
                'label' => 'Leistung nach Spielfeldtyp',
                'config' => [
                    'diagramType' => 'radaroverlay',
                    'xField' => 'surfaceType',
                    'yField' => 'goals',
                    'groupBy' => ['surfaceType'],
                    'metrics' => ['goals', 'assists', 'shots', 'yellowCards', 'fouls'],
                    'radarNormalize' => false,
                    'showLegend' => true,
                ],
            ],
            [
                'key' => 'performance_by_weather',
                'label' => 'Leistung nach Wetterlage',
                'config' => [
                    'diagramType' => 'radaroverlay',
                    'xField' => 'weatherCondition',
                    'yField' => 'goals',
                    'groupBy' => ['weatherCondition'],
                    'metrics' => ['goals', 'assists', 'shots', 'yellowCards', 'fouls'],
                    'radarNormalize' => false,
                    'showLegend' => true,
                ],
            ],
            [
                'key' => 'performance_by_temperature',
                'label' => 'Leistung nach Temperatur',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'temperatureRange',
                    'yField' => 'goals',
                    'groupBy' => ['temperatureRange'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'goals_by_surface_bar',
                'label' => 'Tore pro Spielfeldtyp',
                'config' => [
                    'diagramType' => 'bar',
                    'xField' => 'surfaceType',
                    'yField' => 'goals',
                    'groupBy' => ['surfaceType'],
                    'showLegend' => false,
                ],
            ],
            [
                'key' => 'surface_weather_matrix',
                'label' => 'Spielfeld × Wetter (Vergleich)',
                'config' => [
                    'diagramType' => 'stackedarea',
                    'xField' => 'surfaceType',
                    'yField' => 'goals',
                    'groupBy' => ['weatherCondition'],
                    'showLegend' => true,
                ],
            ],
            [
                'key' => 'wind_performance',
                'label' => 'Leistung bei Wind',
                'config' => [
                    'diagramType' => 'radaroverlay',
                    'xField' => 'windStrength',
                    'yField' => 'goals',
                    'groupBy' => ['windStrength'],
                    'metrics' => ['goals', 'assists', 'shots', 'yellowCards', 'fouls', 'passes'],
                    'radarNormalize' => false,
                    'showLegend' => true,
                ],
            ],
            [
                'key' => 'player_events_by_surface',
                'label' => 'Spieler-Events nach Spielfeldtyp (Radar)',
                'config' => [
                    'diagramType' => 'faceted',
                    'facetSubType' => 'radar',
                    'facetLayout' => 'interactive',
                    'facetBy' => 'surfaceType',
                    'xField' => 'player',
                    'yField' => 'eventType',
                    'groupBy' => ['eventType'],
                    'showLegend' => true,
                    'showLabels' => false,
                ],
            ],
            [
                'key' => 'player_events_by_game_type',
                'label' => 'Spieler-Events nach Spieltyp (Area)',
                'config' => [
                    'diagramType' => 'faceted',
                    'facetSubType' => 'area',
                    'facetLayout' => 'vertical',
                    'facetBy' => 'gameType',
                    'xField' => 'player',
                    'yField' => 'eventType',
                    'groupBy' => ['eventType'],
                    'showLegend' => true,
                    'showLabels' => false,
                ],
            ],
        ];
    }
}
