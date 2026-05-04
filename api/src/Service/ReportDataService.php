<?php

namespace App\Service;

use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\PlayerGameStats;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;

class ReportDataService
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * Generiert die Datenstruktur für einen Report (Labels, Datasets) anhand der Report-Definition.
     *
     * Unterstützte config-Keys (Auszug):
     * - xField, yField, groupBy, filters, diagramType
     * - area: optional field alias (z.B. 'surfaceType') um Events nach einer Area aufzubrechen
     * - areaMode: 'overlay' (separate datasets pro area) oder 'single' (alle Areas zusammenfassen)
     *
     * Filter: zusätzlich zu team/eventType/player/dateFrom/dateTo wird `filters['surfaceType']` unterstützt.
     *
     * @param array<string, mixed> $config Report-Konfiguration
     *
     * @return array<string, mixed>
     */
    public function generateReportData(array $config): array
    {
        $xField = $config['xField'] ?? 'player';
        $yField = $config['yField'] ?? 'goals';
        $filters = $config['filters'] ?? [];
        $this->resolveSeasonFilter($filters);
        $groupBy = $config['groupBy'] ?? [];
        if (!is_array($groupBy)) {
            $groupBy = $groupBy ? [$groupBy] : [];
        }

        // (keine Area-spezifische Logik hier - Chart 'area' wird im Frontend als Line+Fill gerendert)

        // Load alias metadata and check feature flag for DB-based aggregates
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        $useDbAggregates = isset($config['use_db_aggregates']) ? (bool) $config['use_db_aggregates'] : false;

        // Route PlayerGameStats metrics to a dedicated data path
        if (($fieldAliases[$yField]['dataSource'] ?? null) === 'playerGameStats') {
            return $this->generatePlayerGameStatsData($config);
        }

        // If DB aggregates are enabled and a groupBy is provided, attempt a DB-side aggregation
        // supporting multiple groupBy fields. We only handle simple COUNT-based aggregates
        // and a couple of common metric filters (e.g. goals, shots). If unsupported, we
        // fall back to in-memory aggregation and provide meta.suggestions explaining why.
        if ($useDbAggregates && !empty($groupBy)) {
            $metaLocal = ['eventsCount' => 0, 'dbAggregate' => false, 'warnings' => [], 'suggestions' => []];

            // Determine whether the requested yField can be computed in DB
            $yAlias = $fieldAliases[$yField] ?? null;
            $supportedMetric = false;
            // All named aggregate metrics can be computed via simple event-code counting in DB
            $dbSupportedMetrics = ['goals', 'assists', 'shots', 'yellowCards', 'redCards', 'fouls',
                'dribbles', 'saves', 'passes', 'tackles', 'interceptions'];
            if ($yAlias && isset($yAlias['aggregate']) && is_callable($yAlias['aggregate'])) {
                if (in_array($yField, $dbSupportedMetrics, true)) {
                    $supportedMetric = true;
                } else {
                    // Percentage metrics (shotAccuracy, duelsWonPercent) require PHP post-processing
                    $supportedMetric = false;
                    $metaLocal['suggestions'][] = "DB-Aggregate: metric '{$yField}' not supported for DB aggregation (complex PHP aggregate).";
                }
            } else {
                // tokens like eventType:ID or generic count are supported
                $supportedMetric = true;
            }

            if ($supportedMetric) {
                $qb = $this->em->getRepository(GameEvent::class)->createQueryBuilder('e');

                $groupLabelParts = [];
                $groupByIdExprs = [];
                $gbIndex = 0;
                $canUseDb = true;

                foreach ($groupBy as $gField) {
                    $groupAlias = $fieldAliases[$gField] ?? null;
                    if (!$groupAlias || !($groupAlias['accessibleFromEvent'] ?? false)) {
                        $metaLocal['suggestions'][] = "Cannot DB-aggregate by '{$gField}' as it is not accessible from GameEvent.";
                        $canUseDb = false;
                        break;
                    }

                    // Use joinHint if provided, otherwise use path
                    $joinPath = $groupAlias['joinHint'] ?? $groupAlias['path'] ?? [];
                    $labelField = $groupAlias['subfield'] ?? $groupAlias['field'] ?? null;

                    if (empty($joinPath) || !is_array($joinPath)) {
                        $metaLocal['suggestions'][] = "No join path for groupBy '{$gField}', cannot DB-aggregate.";
                        $canUseDb = false;
                        break;
                    }

                    $prevAlias = 'e';
                    $i = 0;
                    $lastAlias = null;
                    foreach ($joinPath as $segment) {
                        $clean = preg_replace('/[^a-zA-Z0-9_]/', '_', $segment);
                        $alias = 'g_' . $clean . '_' . $gbIndex . '_' . $i;
                        // use LEFT JOIN to avoid dropping rows with missing relations
                        $qb->leftJoin($prevAlias . '.' . $segment, $alias);
                        $prevAlias = $alias;
                        $lastAlias = $alias;
                        ++$i;
                    }

                    // joinPath is non-empty (checked above), so lastAlias will be set; no need for extra null-check

                    // Build a COALESCE label part for this group element
                    $part = "COALESCE({$lastAlias}.name, {$lastAlias}.title, {$lastAlias}.label, {$lastAlias}.fullName, " .
                        "CONCAT(COALESCE({$lastAlias}.firstName, ''), ' ', COALESCE({$lastAlias}.lastName, '')), CONCAT('', {$lastAlias}.id))";
                    $groupLabelParts[] = $part;
                    $groupByIdExprs[] = $lastAlias . '.id';

                    ++$gbIndex;
                }

                if ($canUseDb && !empty($groupByIdExprs)) {
                    // Metric-specific WHEREs — map metric key to GameEventType codes
                    $metricCodeMap = [
                        'goals' => ['goal', 'penalty_goal', 'freekick_goal', 'header_goal', 'corner_goal', 'cross_goal', 'counter_goal', 'pressing_goal'],
                        'assists' => ['assist'],
                        'shots' => [
                            'shot_on_target',
                            'shot_off_target',
                            'shot_blocked',
                            'header_on_target',
                            'header_off_target',
                            'long_shot',
                            'volley',
                            'bicycle_kick',
                            'shot_post',
                            'shot_bar'
                        ],
                        'yellowCards' => ['yellow_card'],
                        'redCards' => ['red_card', 'yellow_red_card'],
                        'fouls' => ['foul', 'foul_holding', 'foul_push', 'foul_shove', 'foul_bump', 'foul_trip', 'foul_kick', 'foul_elbow'],
                        'dribbles' => ['dribble_success'],
                        'saves' => ['save', 'keeper_hold', 'keeper_punch', 'penalty_save'],
                        'passes' => ['pass_normal', 'pass_through', 'cross', 'pass_back', 'pass_sideways', 'chip_ball', 'pass_cut', 'long_ball', 'switch_play', 'header_pass'],
                        'tackles' => ['tackle_success'],
                        'interceptions' => ['interception', 'intercept_cross', 'ball_win'],
                    ];

                    if (isset($metricCodeMap[$yField])) {
                        $codes = $metricCodeMap[$yField];
                        $qb->leftJoin('e.gameEventType', 'et');
                        $placeholders = [];
                        foreach ($codes as $ci => $code) {
                            $param = 'mc_' . $ci;
                            $placeholders[] = ':' . $param;
                            $qb->setParameter($param, $code);
                        }
                        $qb->andWhere('et.code IN (' . implode(',', $placeholders) . ')');
                    } elseif (preg_match('/^eventType:(\d+)$/', $yField, $m)) {
                        $qb->andWhere('e.gameEventType = :evtype')->setParameter('evtype', (int) $m[1]);
                    }

                    // Apply standard filters (same as non-DB path)
                    if (isset($filters['teams']) && '' !== $filters['teams']) {
                        $teamIds = array_map('intval', explode(',', (string) $filters['teams']));
                        $qb->andWhere('e.team IN (:teams)')->setParameter('teams', $teamIds);
                    } elseif (isset($filters['team'])) {
                        $qb->andWhere('e.team = :team')->setParameter('team', $filters['team']);
                    }
                    if (isset($filters['eventType'])) {
                        $qb->andWhere('e.gameEventType = :eventType')->setParameter('eventType', $filters['eventType']);
                    }
                    if (isset($filters['player'])) {
                        $qb->andWhere('e.player = :player')->setParameter('player', $filters['player']);
                    }
                    if (isset($filters['players']) && '' !== $filters['players']) {
                        $playerIds = array_map('intval', explode(',', (string) $filters['players']));
                        $qb->andWhere('e.player IN (:players)')->setParameter('players', $playerIds);
                    }
                    if (isset($filters['surfaceType'])) {
                        $qb->leftJoin('e.game', 'g2')->leftJoin('g2.location', 'loc2')
                            ->andWhere('loc2.surfaceType = :surfaceType')->setParameter('surfaceType', (int) $filters['surfaceType']);
                    }
                    if (isset($filters['gameType'])) {
                        $qb->leftJoin('e.game', 'ggt')->andWhere('ggt.gameType = :gameType')->setParameter('gameType', (int) $filters['gameType']);
                    }
                    if (isset($filters['dateFrom'])) {
                        $qb->andWhere('DATE(e.timestamp) >= DATE(:dateFrom)')->setParameter('dateFrom', new DateTimeImmutable($filters['dateFrom']));
                    }
                    if (isset($filters['dateTo'])) {
                        $qb->andWhere('DATE(e.timestamp) <= DATE(:dateTo)')->setParameter('dateTo', new DateTimeImmutable($filters['dateTo']));
                    }

                    // Build label expression by concatenating parts with ' | '
                    $labelExpr = 'CONCAT(' . implode(", ' | ', ", $groupLabelParts) . ')';
                    $qb->addSelect($labelExpr . ' AS label');
                    foreach ($groupByIdExprs as $idx => $gexpr) {
                        $qb->addGroupBy($gexpr);
                    }

                    $qb->select('label');
                    $qb->addSelect('COUNT(e.id) AS value');
                    $rows = $qb->getQuery()->getArrayResult();

                    $labels = array_map(fn ($r) => $r['label'] ?? 'Unbekannt', $rows);
                    $data = array_map(fn ($r) => (float) $r['value'], $rows);

                    $datasetLabel = $fieldAliases[$yField]['label'] ?? $yField;
                    $metaLocal['eventsCount'] = array_sum($data);
                    $metaLocal['dbAggregate'] = true;

                    return [
                        'labels' => $labels,
                        'datasets' => [
                            ['label' => $datasetLabel, 'data' => $data]
                        ],
                        'meta' => $metaLocal,
                    ];
                }
            }
            // If we reach here, DB-aggregate wasn't possible — suggestions were pushed
            // Create concise, user-facing tips (no DB-internals) for the UI and
            // keep the technical suggestions in `metaLocal['suggestions']` for admins.
            $metaLocal['userSuggestions'] = $this->deriveUserSuggestions($metaLocal['suggestions'], $metaLocal['warnings']);

            // Fall back to loading events in PHP below.
        }

        $qb = $this->em->getRepository(GameEvent::class)->createQueryBuilder('e');
        if (isset($filters['teams']) && '' !== $filters['teams']) {
            $teamIds = array_map('intval', explode(',', (string) $filters['teams']));
            $qb->andWhere('e.team IN (:teams)')->setParameter('teams', $teamIds);
        } elseif (isset($filters['team'])) {
            $qb->andWhere('e.team = :team')->setParameter('team', $filters['team']);
        }
        if (isset($filters['eventType'])) {
            $qb->andWhere('e.gameEventType = :eventType')->setParameter('eventType', $filters['eventType']);
        }
        if (isset($filters['player'])) {
            $qb->andWhere('e.player = :player')->setParameter('player', $filters['player']);
        }
        if (isset($filters['players']) && '' !== $filters['players']) {
            $playerIds = array_map('intval', explode(',', (string) $filters['players']));
            $qb->andWhere('e.player IN (:players)')->setParameter('players', $playerIds);
        }
        if (isset($filters['surfaceType'])) {
            // join through game -> location -> surfaceType
            $qb->join('e.game', 'g')->join('g.location', 'loc')->andWhere('loc.surfaceType = :surfaceType')->setParameter('surfaceType', (int) $filters['surfaceType']);
        }
        if (isset($filters['gameType'])) {
            $qb->join('e.game', 'ggt2')->andWhere('ggt2.gameType = :gameType')->setParameter('gameType', (int) $filters['gameType']);
        }
        if (isset($filters['dateFrom'])) {
            $qb->andWhere('DATE(e.timestamp) >= DATE(:dateFrom)')->setParameter('dateFrom', new DateTimeImmutable($filters['dateFrom']));
        }
        if (isset($filters['dateTo'])) {
            $qb->andWhere('DATE(e.timestamp) <= DATE(:dateTo)')->setParameter('dateTo', new DateTimeImmutable($filters['dateTo']));
        }
        // NOTE: any area/surface-type filtering should be done via standard filters
        $events = $qb->getQuery()->getResult();

        // Post-query filtering for precipitation (weather) since weather is stored as JSON
        if (isset($filters['precipitation']) && in_array($filters['precipitation'], ['yes', 'no'], true)) {
            $filtered = [];
            foreach ($events as $ev) {
                $hasPrecip = false;
                if (method_exists($ev, 'getGame') && $ev->getGame() && method_exists($ev->getGame(), 'getCalendarEvent')) {
                    $ce = $ev->getGame()->getCalendarEvent();
                    if ($ce && method_exists($ce, 'getWeatherData')) {
                        $wd = $ce->getWeatherData();
                        if ($wd) {
                            $daily = $wd->getDailyWeatherData();
                            if (is_array($daily) && isset($daily['precipitation_sum'][0]) && is_numeric($daily['precipitation_sum'][0]) && $daily['precipitation_sum'][0] > 0) {
                                $hasPrecip = true;
                            }
                            $hourly = $wd->getHourlyWeatherData();
                            if (!$hasPrecip && is_array($hourly) && isset($hourly['precipitation']) && is_array($hourly['precipitation'])) {
                                foreach ($hourly['precipitation'] as $val) {
                                    if (is_numeric($val) && $val > 0) {
                                        $hasPrecip = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                if ('yes' === $filters['precipitation'] && $hasPrecip) {
                    $filtered[] = $ev;
                }
                if ('no' === $filters['precipitation'] && !$hasPrecip) {
                    $filtered[] = $ev;
                }
            }
            $events = $filtered;
        }

        // Build a meta object we can return to inform the UI about capabilities / data shape
        $meta = [];
        $meta['eventsCount'] = count($events);

        // If DB-aggregate was attempted earlier, merge its meta information
        // (technical suggestions remain for admins; userSuggestions are safe for end users).
        if (isset($metaLocal)) {
            // keep technical suggestions/warnings available for admins
            // phpstan: metaLocal keys are built above but static analysis may be confused
            // @phpstan-ignore-next-line
            if (isset($metaLocal['suggestions']) && count($metaLocal['suggestions']) > 0) {
                $meta['suggestions'] = $metaLocal['suggestions'];
            }
            // @phpstan-ignore-next-line
            if (isset($metaLocal['warnings']) && count($metaLocal['warnings']) > 0) {
                $meta['warnings'] = $metaLocal['warnings'];
            }
            // ensure dbAggregate is always a boolean
            $meta['dbAggregate'] = (bool) $metaLocal['dbAggregate'];
            // user-friendly tips to show to normal users
            // @phpstan-ignore-next-line
            $meta['userSuggestions'] = $metaLocal['userSuggestions'] ?? $this->deriveUserSuggestions($metaLocal['suggestions'] ?? [], $metaLocal['warnings'] ?? []);
        }

        // Spatial heatmap support: if client requested spatial points, try to emit {x:0..100, y:0..100, intensity}
        if (isset($config['diagramType']) && 'pitchheatmap' === $config['diagramType'] && !empty($config['heatmapSpatial'])) {
            $meta['spatialRequested'] = true;
            $points = $this->generateSpatialPoints($events, $config);
            $meta['spatialProvided'] = !empty($points);

            // If we found spatial points, return them.
            // If not, fall back to the regular matrix/grid output so the frontend can still render a heatmap.
            if (!empty($points)) {
                return [
                    'labels' => [],
                    'datasets' => [
                        [
                            'label' => 'Heatmap',
                            'data' => $points,
                        ],
                    ],
                    'diagramType' => 'pitchheatmap',
                    'meta' => $meta,
                ];
            }
            // else: continue and generate matrix-style output below (meta will be attached later)
        }

        // Radar chart handling: expects `metrics` array in config and a `groupBy` (e.g. player/team)
        $diagramType = $config['diagramType'] ?? '';
        $metrics = $config['metrics'] ?? [];
        if (in_array($diagramType, ['radar', 'radaroverlay'], true) && is_array($metrics) && !empty($metrics)) {
            $radarResult = $this->generateReportDataForRadar($events, $metrics, $groupBy);
            // attach meta (eventsCount) for the UI
            $radarResult['meta'] = $radarResult['meta'] ?? [];
            $radarResult['meta']['eventsCount'] = $meta['eventsCount'];

            return $radarResult;
        }

        // Faceted chart handling: split events by a facet dimension (e.g. surfaceType) and generate
        // a separate sub-chart (panel) per facet value. Within each panel, the standard xField/groupBy
        // logic applies, so you get e.g. players × eventTypes per surface type.
        if ('faceted' === $diagramType && !empty($config['facetBy'])) {
            $facetResult = $this->generateReportDataForFaceted($events, $config);
            $facetResult['meta'] = $facetResult['meta'] ?? [];
            $facetResult['meta']['eventsCount'] = $meta['eventsCount'];

            return $facetResult;
        }

        $result = $this->considerGroup($events, $diagramType, $xField, $yField, $groupBy);

        // Ensure a concise, user-facing message is available for the preview UI.
        // Ensure userMessage default is set when there are no events.
        // @phpstan-ignore-next-line
        if (0 === $meta['eventsCount'] && empty($meta['userMessage'])) {
            $meta['userMessage'] = 'Keine Spielereignisse für die gewählten Filter / Zeitraum gefunden.';
        }

        $result['meta'] = $meta;

        return $result;
    }

    /**
     * Generiert die Datenstruktur für ein Radar/Spinnennetz-Diagramm.
     * Erwartet `metrics` (Array von Feld-Aliases) und `groupBy` zur Bildung der Datasets.
     *
     * @param array<string, mixed> $events
     * @param array<int, string>   $metrics
     * @param array<int, string>   $groupBy
     *
     * @return array<string, mixed>
     */
    private function generateReportDataForRadar(array $events, array $metrics, array $groupBy): array
    {
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);

        // Resolve any referenced eventType ids/codes to readable labels
        $eventTypeIds = [];
        $eventCodes = [];
        foreach ($metrics as $m) {
            if (preg_match('/^eventType:(\d+)$/', $m, $matches)) {
                $eventTypeIds[] = (int) $matches[1];
            } elseif (preg_match('/^eventCode:(.+)$/', $m, $matches)) {
                $eventCodes[] = $matches[1];
            }
        }
        $typesById = [];
        if (!empty($eventTypeIds)) {
            $types = $this->em->getRepository(GameEventType::class)->findBy(['id' => $eventTypeIds]);
            foreach ($types as $t) {
                $typesById[$t->getId()] = $t;
            }
        }

        // Build groups keyed by groupBy values
        $groups = [];
        foreach ($events as $event) {
            $layerKeyParts = [];
            foreach ($groupBy as $gField) {
                $layerKeyParts[] = $this->retrieveFieldValue($event, $gField);
            }
            $groupKey = $layerKeyParts ? implode(' | ', $layerKeyParts) : 'All';
            $groups[$groupKey][] = $event;
        }

        // Labels are metric labels
        $labels = [];
        foreach ($metrics as $m) {
            if (preg_match('/^eventType:(\d+)$/', $m, $matches)) {
                $id = (int) $matches[1];
                $labels[] = isset($typesById[$id]) ? $typesById[$id]->getName() : "Ereignis #$id";
                continue;
            }
            if (preg_match('/^eventCode:(.+)$/', $m, $matches)) {
                $labels[] = 'Ereignis: ' . $matches[1];
                continue;
            }
            $labels[] = $fieldAliases[$m]['label'] ?? $m;
        }

        $datasets = [];
        foreach ($groups as $groupLabel => $groupEvents) {
            $data = [];
            foreach ($metrics as $m) {
                $value = 0;
                if (isset($fieldAliases[$m]['aggregate']) && is_callable($fieldAliases[$m]['aggregate'])) {
                    $value = $fieldAliases[$m]['aggregate']($groupEvents);
                } elseif (preg_match('/^eventType:(\d+)$/', $m, $matches)) {
                    // count events with that GameEventType id
                    $typeId = (int) $matches[1];
                    $count = 0;
                    foreach ($groupEvents as $ev) {
                        $et = $ev->getGameEventType();
                        if ($et && $et->getId() === $typeId) {
                            ++$count;
                        }
                    }
                    $value = $count;
                } elseif (preg_match('/^eventCode:(.+)$/', $m, $matches)) {
                    // count events with that EventType code
                    $code = $matches[1];
                    $count = 0;
                    foreach ($groupEvents as $ev) {
                        $et = $ev->getGameEventType();
                        if ($et && $et->getCode() === $code) {
                            ++$count;
                        }
                    }
                    $value = $count;
                } elseif (preg_match('/^surfaceType:(\d+)$/', $m, $matches)) {
                    // count events played on that surface type
                    $surfaceId = (int) $matches[1];
                    $count = 0;
                    foreach ($groupEvents as $ev) {
                        if (method_exists($ev, 'getGame') && $ev->getGame() && method_exists($ev->getGame(), 'getLocation')) {
                            $location = $ev->getGame()->getLocation();
                            if ($location && method_exists($location, 'getSurfaceType')) {
                                $st = $location->getSurfaceType();
                                if ($st && method_exists($st, 'getId') && $st->getId() === $surfaceId) {
                                    ++$count;
                                }
                            }
                        }
                    }
                    $value = $count;
                } elseif ('weather:precipitation' === $m) {
                    // count events where the corresponding calendarEvent weather data indicates precipitation
                    $count = 0;
                    foreach ($groupEvents as $ev) {
                        if (!method_exists($ev, 'getGame') || !$ev->getGame() || !method_exists($ev->getGame(), 'getCalendarEvent')) {
                            continue;
                        }
                        $ce = $ev->getGame()->getCalendarEvent();
                        if (!$ce || !method_exists($ce, 'getWeatherData')) {
                            continue;
                        }
                        $wd = $ce->getWeatherData();
                        if (!$wd) {
                            continue;
                        }
                        // Check daily precipitation sum if available
                        $daily = $wd->getDailyWeatherData();
                        if (is_array($daily) && isset($daily['precipitation_sum'][0]) && is_numeric($daily['precipitation_sum'][0]) && $daily['precipitation_sum'][0] > 0) {
                            ++$count;
                            continue;
                        }
                        // Check hourly precipitation if available
                        $hourly = $wd->getHourlyWeatherData();
                        if (is_array($hourly) && isset($hourly['precipitation']) && is_array($hourly['precipitation'])) {
                            foreach ($hourly['precipitation'] as $val) {
                                if (is_numeric($val) && $val > 0) {
                                    ++$count;
                                    break;
                                }
                            }
                        }
                    }
                    $value = $count;
                } else {
                    // Fallback: count events where the alias/value returns a truthy value
                    $count = 0;
                    foreach ($groupEvents as $ev) {
                        $v = $this->retrieveFieldValue($ev, $m);
                        if (null !== $v && '' !== $v) {
                            ++$count;
                        }
                    }
                    $value = $count;
                }

                // Ensure numeric (cast to float)
                $value = (float) $value;
                $data[] = $value;
            }

            $datasets[] = [
                'label' => $groupLabel,
                'data' => $data,
            ];
        }

        // check if any non-zero value exists (useful to warn the UI)
        $hasNonZero = false;
        foreach ($datasets as $ds) {
            foreach ($ds['data'] as $v) {
                if (0 != $v) {
                    $hasNonZero = true;
                    break 2;
                }
            }
        }

        return [
            'labels' => $labels,
            'datasets' => $datasets,
            'diagramType' => 'radar',
            'meta' => ['radarHasData' => $hasNonZero],
        ];
    }

    /**
     * Generiert die Datenstruktur für ein facettiertes Diagramm (Small Multiples).
     *
     * Splittet alle Events nach dem `facetBy`-Feld (z.B. surfaceType) in Panels auf.
     * Innerhalb jedes Panels wird nach xField (z.B. player) gruppiert und die groupBy-Dimension
     * (z.B. eventType) erzeugt separate Datasets (Balken/Linien pro Panel).
     *
     * `facetSubType` steuert den Chart-Typ pro Panel:
     *   - 'bar' (default): Balkendiagramm — labels = xField, datasets = groupBy layers
     *   - 'radar': Radar — labels = groupBy layers (Ereignistypen), datasets = xField (Spieler)
     *   - 'area'/'line': Linien/Flächen — labels = xField, datasets = groupBy layers
     *
     * Ergebnis-Struktur:
     *   { diagramType: 'faceted', facetSubType, panels: [ { title, labels, datasets }, ... ], meta }
     *
     * @param array<int, GameEvent> $events
     * @param array<string, mixed>  $config
     *
     * @return array<string, mixed>
     */
    private function generateReportDataForFaceted(array $events, array $config): array
    {
        $facetBy = $config['facetBy'];
        $xField = $config['xField'] ?? 'player';
        $groupBy = $config['groupBy'] ?? [];
        if (!is_array($groupBy)) {
            $groupBy = $groupBy ? [$groupBy] : [];
        }
        $facetSubType = $config['facetSubType'] ?? 'bar';
        $facetTranspose = (bool) ($config['facetTranspose'] ?? ('radar' === $facetSubType));
        $facetLayout = $config['facetLayout'] ?? 'grid';

        // 1) Split events into buckets keyed by facet value
        $facetBuckets = [];
        foreach ($events as $event) {
            $facetVal = $this->stringifyValue($this->retrieveFieldValue($event, $facetBy));
            $facetBuckets[$facetVal][] = $event;
        }
        ksort($facetBuckets);

        // 2) Collect ALL possible x-labels and layer keys across all facets
        //    so every panel has the same structure (consistent comparison)
        $allXLabels = [];
        $allXSortKeys = [];
        $allLayerKeys = [];
        foreach ($facetBuckets as $facetEvents) {
            foreach ($facetEvents as $event) {
                $x = $this->stringifyValue($this->retrieveFieldValue($event, $xField));
                $allXLabels[$x] = true;
                if (!isset($allXSortKeys[$x])) {
                    $allXSortKeys[$x] = $this->retrieveSortKey($event, $xField);
                }

                if (!empty($groupBy)) {
                    $parts = [];
                    foreach ($groupBy as $gField) {
                        $parts[] = $this->stringifyValue($this->retrieveFieldValue($event, $gField));
                    }
                    $layerKey = implode(' | ', $parts);
                    $allLayerKeys[$layerKey] = true;
                }
            }
        }
        $xLabels = array_keys($allXLabels);
        // Sort by sort key (handles date/month fields correctly; falls back to display value)
        usort($xLabels, fn ($a, $b) => strcmp($allXSortKeys[$a] ?? $a, $allXSortKeys[$b] ?? $b));
        $layers = array_keys($allLayerKeys);
        sort($layers);

        // 3) Build panels
        $panels = [];
        foreach ($facetBuckets as $facetLabel => $facetEvents) {
            if (!empty($groupBy)) {
                // Build matrix: layer -> x -> count
                $matrix = [];
                foreach ($facetEvents as $event) {
                    $x = $this->stringifyValue($this->retrieveFieldValue($event, $xField));
                    $parts = [];
                    foreach ($groupBy as $gField) {
                        $parts[] = $this->stringifyValue($this->retrieveFieldValue($event, $gField));
                    }
                    $layerKey = implode(' | ', $parts);
                    if (!isset($matrix[$layerKey][$x])) {
                        $matrix[$layerKey][$x] = 0;
                    }
                    ++$matrix[$layerKey][$x];
                }

                // Transpose: labels = layers (e.g. event types) and datasets = x-values (e.g. players)
                // Default for radar, configurable via facetTranspose
                if ($facetTranspose) {
                    $datasets = [];
                    foreach ($xLabels as $xVal) {
                        $data = [];
                        foreach ($layers as $layerKey) {
                            $data[] = $matrix[$layerKey][$xVal] ?? 0;
                        }
                        $datasets[] = [
                            'label' => $xVal,
                            'data' => $data,
                        ];
                    }
                    $panels[] = [
                        'title' => $facetLabel,
                        'labels' => $layers,   // event types as radar axes
                        'datasets' => $datasets, // players as overlay layers
                    ];
                } else {
                    // bar / line / area: labels = x-values, datasets = layers
                    $datasets = [];
                    foreach ($layers as $layerKey) {
                        $data = [];
                        foreach ($xLabels as $xVal) {
                            $data[] = $matrix[$layerKey][$xVal] ?? 0;
                        }
                        $datasets[] = [
                            'label' => $layerKey,
                            'data' => $data,
                        ];
                    }
                    $panels[] = [
                        'title' => $facetLabel,
                        'labels' => $xLabels,
                        'datasets' => $datasets,
                    ];
                }
            } else {
                // No groupBy: single dataset counting events per x-value
                $counts = [];
                foreach ($facetEvents as $event) {
                    $x = $this->stringifyValue($this->retrieveFieldValue($event, $xField));
                    $counts[$x] = ($counts[$x] ?? 0) + 1;
                }
                $data = [];
                foreach ($xLabels as $xVal) {
                    $data[] = $counts[$xVal] ?? 0;
                }
                $datasets = [
                    ['label' => 'Anzahl', 'data' => $data],
                ];
                $panels[] = [
                    'title' => $facetLabel,
                    'labels' => $xLabels,
                    'datasets' => $datasets,
                ];
            }
        }

        return [
            'labels' => [],
            'datasets' => [],
            'diagramType' => 'faceted',
            'facetSubType' => $facetSubType,
            'facetLayout' => $facetLayout,
            'panels' => $panels,
            'meta' => [
                'facetBy' => $facetBy,
                'facetSubType' => $facetSubType,
                'facetTranspose' => $facetTranspose,
                'facetLayout' => $facetLayout,
                'panelCount' => count($panels),
            ],
        ];
    }

    /**
     * Berücksichtigt die Gruppierung der Report-Daten.
     *
     * @param array<string, mixed> $events
     * @param array<string, mixed> $groupBy
     *
     * @return array<string, mixed>
     */
    private function considerGroup(array $events, string $diagramType, string $xField, string $yField, array $groupBy): array
    {
        // Prevent N×N cross-product matrix: strip any groupBy field that is the same as xField.
        // E.g. xField=player + groupBy=player would produce one dataset per player plotted against
        // all players — resulting in 89 datasets mostly filled with zeros.
        $groupBy = array_values(array_filter($groupBy, fn ($gf) => $gf !== $xField));

        if (empty($groupBy)) {
            return $this->generateReportDataForLineOrBarWithoutGroup($events, $xField, $yField);
        }

        return $this->generateReportDataForGroup($events, $xField, $yField, $groupBy, $diagramType);
    }

    /**
     * Generiert die Datenstruktur für ein Kreisdiagramm ohne Gruppierung.
     *
     * @param array<string, mixed> $events
     *
     * @return array<string, mixed>
     */
    private function generateReportDataForPieWithoutGroup(array $events, string $yField): array
    {
        // Pie: Verteilung der yField-Werte (mit Fallback)
        $counts = [];
        foreach ($events as $event) {
            $y = $this->retrieveFieldValue($event, $yField);
            if (null === $y || '' === $y) {
                $y = 'Unbekannt';
            }
            $counts[$y] = ($counts[$y] ?? 0) + 1;
        }

        // Load alias metadata to resolve human-friendly labels for the dataset
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        $datasetLabel = $fieldAliases[$yField]['label'] ?? $yField;

        return [
            'labels' => array_keys($counts),
            'datasets' => [
                [
                    'label' => $datasetLabel,
                    'data' => array_values($counts),
                ]
            ],
        ];
    }

    /**
     * Generiert die Datenstruktur für ein Liniendiagramm oder Säulendiagramm ohne Gruppierung.
     *
     * @param array<string, mixed> $events
     *
     * @return array<string, mixed>
     */
    private function generateReportDataForLineOrBarWithoutGroup(array $events, string $xField, string $yField): array
    {
        // Resolve yField metric aggregate (if available)
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        $yAggregate = isset($fieldAliases[$yField]['aggregate']) && is_callable($fieldAliases[$yField]['aggregate'])
            ? $fieldAliases[$yField]['aggregate']
            : null;

        // Bar/Line: X = xField, Y = metric aggregate (or raw event count) per X bucket
        /** @var array<string, list<mixed>> $buckets */
        $buckets = [];
        $sortKeys = [];
        foreach ($events as $event) {
            $x = $this->retrieveFieldValue($event, $xField);
            if (null === $x || '' === $x) {
                $x = 'Unbekannt';
            }
            $x = $this->stringifyValue($x);
            $buckets[$x][] = $event;
            if (!isset($sortKeys[$x])) {
                $sortKeys[$x] = $this->retrieveSortKey($event, $xField);
            }
        }
        $xLabels = array_keys($buckets);
        // Sort by sort key (handles date/month fields correctly; falls back to display value)
        usort($xLabels, fn ($a, $b) => strcmp($sortKeys[$a] ?? $a, $sortKeys[$b] ?? $b));
        $data = [];
        foreach ($xLabels as $x) {
            $data[] = null !== $yAggregate ? (float) $yAggregate($buckets[$x]) : count($buckets[$x]);
        }

        // Load alias metadata to resolve human-friendly labels for the dataset
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        $datasetLabel = $fieldAliases[$yField]['label'] ?? $yField;

        return [
            'labels' => $xLabels,
            'datasets' => [
                [
                    'label' => $datasetLabel,
                    'data' => $data,
                ]
            ],
        ];
    }

    /**
     * Generiert die Datenstruktur für ein gruppiertes Diagramm.
     *
     * @param array<string, mixed> $events
     * @param array<string>        $groupBy
     *
     * @return array<string, mixed>
     */
    private function generateReportDataForGroup(array $events, string $xField, string $yField, array $groupBy, string $diagramType = ''): array
    {
        // Resolve yField metric aggregate (if available)
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        $yAggregate = isset($fieldAliases[$yField]['aggregate']) && is_callable($fieldAliases[$yField]['aggregate'])
            ? $fieldAliases[$yField]['aggregate']
            : null;

        // Mit groupBy: X = xField, Layer = groupBy, Y = yField metric (or raw event count)
        $xValues = [];
        $xSortKeys = [];
        $layerValues = [];
        // When a metric aggregate is needed, collect event buckets; otherwise count directly
        /** @var array<string, array<string, list<mixed>>> $eventBuckets */
        $eventBuckets = [];
        $matrix = [];
        foreach ($events as $event) {
            // Normalize x and groupBy values to safe string keys (entities/proxies may be returned)
            $xRaw = $this->retrieveFieldValue($event, $xField);
            $x = $this->stringifyValue($xRaw);

            $layerKeyParts = [];
            foreach ($groupBy as $gField) {
                $valRaw = $this->retrieveFieldValue($event, $gField);
                $layerKeyParts[] = $this->stringifyValue($valRaw);
            }
            $layerKey = $layerKeyParts ? implode(' | ', $layerKeyParts) : '';
            $xValues[$x] = true;
            if (!isset($xSortKeys[$x])) {
                $xSortKeys[$x] = $this->retrieveSortKey($event, $xField);
            }
            $layerValues[$layerKey] = true;
            if (null !== $yAggregate) {
                $eventBuckets[$layerKey][$x][] = $event;
            } else {
                if (!isset($matrix[$layerKey][$x])) {
                    $matrix[$layerKey][$x] = 0;
                }
                ++$matrix[$layerKey][$x];
            }
        }
        $xLabels = array_keys($xValues);
        // Sort by sort key (handles date/month fields correctly; falls back to display value)
        usort($xLabels, fn ($a, $b) => strcmp($xSortKeys[$a] ?? $a, $xSortKeys[$b] ?? $b));
        $layers = array_keys($layerValues);
        sort($layers);

        $isLineLike = in_array($diagramType, ['line', 'area', 'stackedarea', 'scatter'], true);
        $datasets = [];
        foreach ($layers as $layerKey) {
            $data = [];
            foreach ($xLabels as $xVal) {
                if (null !== $yAggregate) {
                    $bucket = $eventBuckets[$layerKey][$xVal] ?? [];
                    $data[] = !empty($bucket) ? (float) $yAggregate($bucket) : ($isLineLike ? null : 0.0);
                } else {
                    $data[] = isset($matrix[$layerKey][$xVal]) ? $matrix[$layerKey][$xVal] : ($isLineLike ? null : 0);
                }
            }
            $datasets[] = [
                'label' => $layerKey,
                'data' => $data,
            ];
        }

        return [
            'labels' => $xLabels,
            'datasets' => $datasets,
        ];
    }

    /**
     * Returns a sort key for an event's field value.
     * Uses the field alias's 'sortKey' callback if available (e.g. for date/month fields),
     * otherwise falls back to the display value for standard lexicographic sort.
     */
    private function retrieveSortKey(GameEvent $event, string $field): string
    {
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        if (isset($fieldAliases[$field]['sortKey']) && is_callable($fieldAliases[$field]['sortKey'])) {
            $key = $fieldAliases[$field]['sortKey']($event);

            return (null !== $key && '' !== $key) ? (string) $key : 'zzzz';
        }

        // Fallback: use display value (lexicographic sort)
        return $this->stringifyValue($this->retrieveFieldValue($event, $field));
    }

    private function retrieveFieldValue(GameEvent $event, string $field): mixed
    {
        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        if (isset($fieldAliases[$field]['value']) && is_callable($fieldAliases[$field]['value'])) {
            return $fieldAliases[$field]['value']($event);
        }

        /* TODO kann zukünftig eher weg, das soll alles nur noch über die alias definition laufen! */
        $getter = 'get' . ucfirst($field);
        if (method_exists($event, $getter)) {
            $value = $event->$getter();
            if (is_object($value) && method_exists($value, '__toString')) {
                return (string) $value;
            }

            return $value;
        }

        return null;
    }

    /**
     * Convert various value types (entity proxies, objects, arrays) into a safe string
     * suitable for use as array keys / labels in charts.
     */
    private function stringifyValue(mixed $v): string
    {
        if (null === $v || '' === $v) {
            return 'Unbekannt';
        }

        if (is_scalar($v)) {
            return (string) $v;
        }

        if (is_array($v)) {
            return json_encode($v, JSON_UNESCAPED_UNICODE);
        }

        if (is_object($v)) {
            if (method_exists($v, 'getName')) {
                return (string) $v->getName();
            }
            if (method_exists($v, 'getTitle')) {
                return (string) $v->getTitle();
            }
            if (method_exists($v, 'getLabel')) {
                return (string) $v->getLabel();
            }
            if (method_exists($v, 'getFullName')) {
                return (string) $v->getFullName();
            }
            if (method_exists($v, 'getFirstName') && method_exists($v, 'getLastName')) {
                return trim((string) $v->getFirstName() . ' ' . (string) $v->getLastName());
            }
            if (method_exists($v, 'getId')) {
                return (string) $v->getId();
            }
            if (method_exists($v, '__toString')) {
                return (string) $v;
            }

            return get_class($v);
        }

        return (string) $v;
    }

    /**
     * Convert technical suggestions/warnings into short, user-facing tips (German).
     * These tips must not contain DB-internal details and are intended for normal users.
     *
     * @return array<int, string>
     */
    /**
     * Resolves a semantic 'seasonFilter' value to concrete dateFrom/dateTo entries
     * in the given $filters array, then removes the seasonFilter key.
     *
     * 'current'  → always the running season (Aug 1 – Jun 30 of next year).
     * '2024'     → fixed season 2024/25 (Aug 2024 – Jun 2025).
     *
     * Call this at the top of any method that reads $filters from $config.
     *
     * @param array<string,mixed> $filters reference to the filters array (will be modified in place)
     */
    private function resolveSeasonFilter(array &$filters): void
    {
        $seasonFilter = $filters['seasonFilter'] ?? null;
        if (null === $seasonFilter) {
            return;
        }

        $now = new DateTimeImmutable();
        $month = (int) $now->format('n');
        $year = (int) $now->format('Y');

        if ('current' === $seasonFilter) {
            $seasonYear = $month >= 8 ? $year : $year - 1;
        } else {
            $seasonYear = (int) $seasonFilter;
        }

        $filters['dateFrom'] = sprintf('%d-08-01', $seasonYear);
        $filters['dateTo'] = sprintf('%d-06-30', $seasonYear + 1);
        unset($filters['seasonFilter']);
    }

    /**
     * @param string[] $suggestions
     * @param string[] $warnings
     *
     * @return string[]
     */
    private function deriveUserSuggestions(array $suggestions, array $warnings = []): array
    {
        $tips = [];

        if (empty($suggestions) && empty($warnings)) {
            $tips[] = "Tipp: Probiere eines der Presets (z.B. 'Tore pro Spieler'), die meist schnelle Ergebnisse liefern.";

            return array_values(array_unique($tips));
        }

        foreach ($suggestions as $s) {
            $ls = strtolower($s);
            if (str_contains($ls, 'metric') && str_contains($ls, 'not supported')) {
                $tips[] = "Tipp: Für diese Metrik ist eine genauere Berechnung erforderlich; wähle 'Anzahl' oder 'Tore' für schnellere Ergebnisse.";
                continue;
            }
            if (str_contains($ls, 'no join path') || str_contains($ls, 'join path') || str_contains($ls, 'not accessible') || str_contains($ls, 'unable to build join')) {
                $tips[] = "Tipp: Wähle ein Feld, das direkt mit dem Ereignis verknüpft ist (z. B. 'player' oder 'team') oder verwende ein Preset.";
                continue;
            }
            if (str_contains($ls, 'db-aggregate') || str_contains($ls, 'db aggregate')) {
                $tips[] = 'Tipp: Entferne komplexe Gruppierungen oder wähle ein Preset für eine schnellere Vorschau.';
                continue;
            }

            $tips[] = 'Tipp: Entferne komplexe Filter/Gruppierungen oder verwende eines der Presets für schnellere Ergebnisse.';
        }

        if (!empty($warnings)) {
            $tips[] = 'Tipp: Prüfe die gesetzten Filter und den Zeitraum; erweitere ggf. den Zeitraum oder entferne Filter.';
        }

        return array_values(array_unique($tips));
    }

    /**
     * Versucht aus GameEvent-Objekten räumliche Koordinaten zu extrahieren.
     * Unterstützt verschiedene mögliche Getter-Namen (z.B. getPosX/getPosY, getX/getY).
     * Liefert Punkte im Format [{x:0..100, y:0..100, intensity: number}, ...].
     *
     * @param array<string, mixed> $events
     * @param array<string, mixed> $config
     *
     * @return array<int, array<string, float|int>>
     */
    private function generateSpatialPoints(array $events, array $config): array
    {
        $points = [];
        foreach ($events as $ev) {
            $x = null;
            $y = null;

            if (method_exists($ev, 'getPosX') && method_exists($ev, 'getPosY')) {
                $x = $ev->getPosX();
                $y = $ev->getPosY();
            } elseif (method_exists($ev, 'getX') && method_exists($ev, 'getY')) {
                $x = $ev->getX();
                $y = $ev->getY();
            } elseif (method_exists($ev, 'getCanvasX') && method_exists($ev, 'getCanvasY')) {
                $x = $ev->getCanvasX();
                $y = $ev->getCanvasY();
            }

            if (!is_numeric($x) || !is_numeric($y)) {
                continue;
            }

            $x = (float) $x;
            $y = (float) $y;

            // Normalize fractions to percent if needed
            if ($x <= 1 && $x >= 0) {
                $x = $x * 100.0;
            }
            if ($y <= 1 && $y >= 0) {
                $y = $y * 100.0;
            }

            // Clamp
            $x = max(0.0, min(100.0, $x));
            $y = max(0.0, min(100.0, $y));

            $intensity = 1.0;
            if (!empty($config['heatmapIntensityField'])) {
                $v = $this->retrieveFieldValue($ev, (string) $config['heatmapIntensityField']);
                if (is_numeric($v)) {
                    $intensity = (float) $v;
                }
            }

            $points[] = [
                'x' => round($x, 2),
                'y' => round($y, 2),
                'intensity' => $intensity,
            ];
        }

        return $points;
    }

    /**
     * Generiert Report-Daten aus PlayerGameStats (Spielstatistiken je Spiel).
     *
     * Wird genutzt, wenn das angeforderte yField zu einer PlayerGameStats-Metrik gehört,
     * z.B. minutesPlayed, distanceCovered, passesCompleted, shotsOnTarget, foulsSuffered.
     *
     * Unterstützte xFields: 'player', 'month'
     * Unterstützte Filter: player, players, team, teams, dateFrom, dateTo
     *
     * @param array<string, mixed> $config
     *
     * @return array<string, mixed>
     */
    private function generatePlayerGameStatsData(array $config): array
    {
        $xField = $config['xField'] ?? 'player';
        $yField = $config['yField'] ?? 'minutesPlayed';
        $filters = $config['filters'] ?? [];
        $this->resolveSeasonFilter($filters);

        $fieldAliases = ReportFieldAliasService::fieldAliases($this->em);
        $yAlias = $fieldAliases[$yField] ?? [];
        $pgsField = $yAlias['pgsField'] ?? $yField;
        $datasetLabel = $yAlias['label'] ?? $yField;

        $qb = $this->em->getRepository(PlayerGameStats::class)->createQueryBuilder('pgs')
            ->join('pgs.player', 'p')
            ->join('pgs.game', 'g')
            ->leftJoin('g.calendarEvent', 'ce')
            ->leftJoin('g.homeTeam', 'ht')
            ->leftJoin('g.awayTeam', 'at');

        // ── Filter ──────────────────────────────────────────────────────────
        if (isset($filters['player']) && '' !== (string) $filters['player']) {
            $qb->andWhere('p.id = :player')->setParameter('player', (int) $filters['player']);
        }
        if (isset($filters['players']) && '' !== (string) $filters['players']) {
            $playerIds = array_map('intval', explode(',', (string) $filters['players']));
            $qb->andWhere('p.id IN (:players)')->setParameter('players', $playerIds);
        }
        if (isset($filters['team']) && '' !== (string) $filters['team']) {
            $qb->andWhere('ht.id = :team OR at.id = :team')
               ->setParameter('team', (int) $filters['team']);
        }
        if (isset($filters['teams']) && '' !== (string) $filters['teams']) {
            $teamIds = array_map('intval', explode(',', (string) $filters['teams']));
            $qb->andWhere('ht.id IN (:teams) OR at.id IN (:teams)')
               ->setParameter('teams', $teamIds);
        }
        if (isset($filters['dateFrom']) && '' !== (string) $filters['dateFrom']) {
            $qb->andWhere('ce.startDate >= :dateFrom')
               ->setParameter('dateFrom', new DateTimeImmutable($filters['dateFrom']));
        }
        if (isset($filters['dateTo']) && '' !== (string) $filters['dateTo']) {
            $qb->andWhere('ce.startDate <= :dateTo')
               ->setParameter('dateTo', new DateTimeImmutable($filters['dateTo']));
        }

        /** @var PlayerGameStats[] $stats */
        $stats = $qb->getQuery()->getResult();

        // ── Helper: derive X label and sort key ─────────────────────────────
        $getXLabel = function (PlayerGameStats $s) use ($xField): string {
            if ('player' === $xField) {
                $player = $s->getPlayer();
                $fn = $player->getFirstName();
                $ln = $player->getLastName();

                return trim($fn . ' ' . $ln) ?: ('Spieler #' . $player->getId());
            }
            if ('month' === $xField) {
                $ce = $s->getGame()->getCalendarEvent();
                if ($ce) {
                    $date = $ce->getStartDate();
                    if ($date instanceof DateTimeInterface) {
                        $months = [1 => 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

                        return $months[(int) $date->format('n')] . ' ' . $date->format('Y');
                    }
                }
            }

            return 'Unbekannt';
        };
        $getSortKey = function (PlayerGameStats $s) use ($xField): string {
            if ('month' === $xField) {
                $ce = $s->getGame()->getCalendarEvent();
                if ($ce) {
                    $date = $ce->getStartDate();
                    if ($date instanceof DateTimeInterface) {
                        return $date->format('Y-m');
                    }
                }
            }
            if ('player' === $xField) {
                $player = $s->getPlayer();
                $fn = $player->getFirstName();
                $ln = $player->getLastName();

                return trim($fn . ' ' . $ln) ?: 'zzzz';
            }

            return 'zzzz';
        };
        $getValue = function (PlayerGameStats $s) use ($pgsField): float {
            $getter = 'get' . ucfirst($pgsField);
            if (method_exists($s, $getter)) {
                return (float) ($s->$getter() ?? 0);
            }

            return 0.0;
        };

        // ── Aggregate: SUM the field value per x-label bucket ───────────────
        /** @var array<string, float> $buckets */
        $buckets = [];
        $sortKeys = [];
        foreach ($stats as $stat) {
            $x = $getXLabel($stat);
            if (!isset($buckets[$x])) {
                $buckets[$x] = 0.0;
                $sortKeys[$x] = $getSortKey($stat);
            }
            $buckets[$x] += $getValue($stat);
        }

        $xLabels = array_keys($buckets);
        usort($xLabels, fn ($a, $b) => strcmp($sortKeys[$a] ?? $a, $sortKeys[$b] ?? $b));
        $data = array_map(fn ($x) => $buckets[$x], $xLabels);

        return [
            'labels' => $xLabels,
            'datasets' => [
                ['label' => $datasetLabel, 'data' => $data],
            ],
            'meta' => [
                'eventsCount' => count($stats),
                'dataSource' => 'playerGameStats',
                'userMessage' => 0 === count($stats)
                    ? 'Keine Spielstatistiken für die gewählten Filter / Zeitraum gefunden.'
                    : null,
            ],
        ];
    }
}
