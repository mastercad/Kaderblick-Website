<?php

namespace App\Service;

use App\Entity\GameEventType;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;

class ReportFieldAliasService
{
    /** In-process cache — reset once per request lifecycle.
     * @var array<string, array<string, mixed>>|null
     */
    private static ?array $cache = null;

    /**
     * Returns a list of user-friendly report field aliases and their mapping to entity fields.
     * Designed for non-technical users (parents, coaches, players, youth).
     *
     * @return array<string, array<string, mixed>>
     */
    public static function fieldAliases(?EntityManagerInterface $em = null): array
    {
        // Cache only when an EntityManager is provided (production path).
        // Calling without EM (e.g. in unit tests) must never pollute the cache
        // because the closures capture $typesByCode at construction time.
        if (null !== $em && null !== self::$cache) {
            return self::$cache;
        }

        // If an EntityManager is provided we can resolve GameEventType ids for code-based aliases
        $typesByCode = [];
        $typesById = [];
        if (null !== $em) {
            $types = $em->getRepository(GameEventType::class)->findAll();
            foreach ($types as $t) {
                $typesByCode[$t->getCode()] = $t;
                $typesById[$t->getId()] = $t;
            }
        }

        // Helper: count events matching a set of GameEventType codes
        $countByCodes = static function (array $events, array $codes) use ($typesByCode): int {
            $ids = [];
            foreach ($codes as $code) {
                if (isset($typesByCode[$code])) {
                    $ids[] = $typesByCode[$code]->getId();
                }
            }
            $c = 0;
            foreach ($events as $e) {
                if (!method_exists($e, 'getGameEventType')) {
                    continue;
                }
                $t = $e->getGameEventType();
                if (!$t) {
                    continue;
                }
                if (!empty($ids) && in_array($t->getId(), $ids, true)) {
                    ++$c;
                } elseif (in_array($t->getCode(), $codes, true)) {
                    ++$c;
                }
            }

            return $c;
        };

        $aliases = [
            // ─── Dimensions (X-Axis / GroupBy) ────────────────────────────

            'player' => [
                'label' => 'Spieler',
                'entity' => 'GameEvent',
                'field' => 'player',
                'type' => 'relation',
                'subfield' => 'fullName',
                'category' => 'dimension',
            ],
            'team' => [
                'label' => 'Mannschaft',
                'entity' => 'GameEvent',
                'field' => 'team',
                'type' => 'relation',
                'subfield' => 'name',
                'category' => 'dimension',
            ],
            'eventType' => [
                'label' => 'Ereignistyp',
                'value' => static function ($event) {
                    $type = $event->getGameEventType();

                    return $type ? $type->getName() : null;
                },
                'entity' => 'GameEvent',
                'field' => 'gameEventType',
                'type' => 'relation',
                'subfield' => 'name',
                'category' => 'dimension',
            ],
            'gameDate' => [
                'label' => 'Spieldatum',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if ($ce) {
                        $date = $ce->getStartDate();
                        if ($date instanceof DateTimeInterface) {
                            return $date->format('d.m.Y');
                        }
                    }

                    return null;
                },
                'sortKey' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if ($ce) {
                        $date = $ce->getStartDate();
                        if ($date instanceof DateTimeInterface) {
                            return $date->format('Y-m-d'); // ISO format for correct lexicographic sort
                        }
                    }

                    return '9999-99-99';
                },
                'entity' => 'Game',
                'field' => 'startDate',
                'type' => 'date',
                'category' => 'dimension',
            ],
            'month' => [
                'label' => 'Monat',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if ($ce) {
                        $date = $ce->getStartDate();
                        if ($date instanceof DateTimeInterface) {
                            // German month names for display
                            $months = [1 => 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

                            return $months[(int) $date->format('n')] . ' ' . $date->format('Y');
                        }
                    }

                    return null;
                },
                'sortKey' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if ($ce) {
                        $date = $ce->getStartDate();
                        if ($date instanceof DateTimeInterface) {
                            return $date->format('Y-m'); // e.g. "2024-03" for correct chronological sort
                        }
                    }

                    return '9999-99';
                },
                'entity' => 'Game',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'gameType' => [
                'label' => 'Spieltyp',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    if ($game && method_exists($game, 'getGameType')) {
                        $gt = $game->getGameType();

                        return $gt ? $gt->getName() : null;
                    }

                    return null;
                },
                'entity' => 'Game',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'competitionType' => [
                'label' => 'Wettbewerbstyp',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    if (!$game) {
                        return null;
                    }
                    if (method_exists($game, 'getLeague') && null !== $game->getLeague()) {
                        return 'Liga';
                    }
                    if (method_exists($game, 'getCup') && null !== $game->getCup()) {
                        return 'Pokal';
                    }
                    if (method_exists($game, 'getTournamentMatch') && null !== $game->getTournamentMatch()) {
                        return 'Turnier';
                    }

                    return 'Freundschaftsspiel';
                },
                'sortKey' => static function ($event) {
                    $game = $event->getGame();
                    if (!$game) {
                        return 'z';
                    }
                    if (method_exists($game, 'getLeague') && null !== $game->getLeague()) {
                        return 'a_liga';
                    }
                    if (method_exists($game, 'getCup') && null !== $game->getCup()) {
                        return 'b_pokal';
                    }
                    if (method_exists($game, 'getTournamentMatch') && null !== $game->getTournamentMatch()) {
                        return 'c_turnier';
                    }

                    return 'd_freundschaft';
                },
                'entity' => 'Game',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'position' => [
                'label' => 'Position',
                'value' => static function ($event) {
                    $player = $event->getPlayer();
                    if ($player && method_exists($player, 'getMainPosition')) {
                        $pos = $player->getMainPosition();

                        return $pos ? $pos->getName() : null;
                    }

                    return null;
                },
                'entity' => 'Player',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'homeAway' => [
                'label' => 'Heim / Auswärts',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $team = $event->getTeam();
                    if (!$game || !$team) {
                        return null;
                    }
                    $homeTeam = $game->getHomeTeam();
                    if ($homeTeam && $homeTeam->getId() === $team->getId()) {
                        return 'Heim';
                    }
                    $awayTeam = $game->getAwayTeam();
                    if ($awayTeam && $awayTeam->getId() === $team->getId()) {
                        return 'Auswärts';
                    }

                    return 'Unbekannt';
                },
                'entity' => 'Game',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'surfaceType' => [
                'label' => 'Spielfeldtyp',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    if (!$game) {
                        return null;
                    }
                    $location = $game->getLocation();
                    if (!$location) {
                        return null;
                    }
                    $st = $location->getSurfaceType();

                    return $st ? $st->getName() : null;
                },
                'entity' => 'Location',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'weatherCondition' => [
                'label' => 'Wetterlage',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if (!$ce) {
                        return null;
                    }
                    $wd = $ce->getWeatherData();
                    if (!$wd) {
                        return null;
                    }
                    $daily = $wd->getDailyWeatherData();
                    $code = $daily['weathercode'][0] ?? null;
                    if (null === $code) {
                        // fallback to hourly
                        $hourly = $wd->getHourlyWeatherData();
                        $code = $hourly['weathercode'][0] ?? null;
                    }
                    if (null === $code) {
                        return null;
                    }
                    $code = (int) $code;
                    // WMO Weather interpretation codes
                    if ($code <= 3) {
                        return 'Sonnig / Klar';
                    }
                    if (in_array($code, [45, 48], true)) {
                        return 'Nebel';
                    }
                    if ($code >= 51 && $code <= 57) {
                        return 'Nieselregen';
                    }
                    if (($code >= 61 && $code <= 67) || ($code >= 80 && $code <= 82)) {
                        return 'Regen';
                    }
                    if (($code >= 71 && $code <= 77) || ($code >= 85 && $code <= 86)) {
                        return 'Schnee';
                    }
                    if ($code >= 95) {
                        return 'Gewitter';
                    }

                    return 'Sonstiges';
                },
                'entity' => 'CalendarEvent',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'temperatureRange' => [
                'label' => 'Temperaturbereich',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if (!$ce) {
                        return null;
                    }
                    $wd = $ce->getWeatherData();
                    if (!$wd) {
                        return null;
                    }
                    $daily = $wd->getDailyWeatherData();
                    $tempMax = $daily['temperature_2m_max'][0] ?? null;
                    if (null === $tempMax) {
                        $hourly = $wd->getHourlyWeatherData();
                        if (is_array($hourly) && !empty($hourly['temperature_2m'])) {
                            $tempMax = max($hourly['temperature_2m']);
                        }
                    }
                    if (null === $tempMax || !is_numeric($tempMax)) {
                        return null;
                    }
                    $t = (float) $tempMax;
                    if ($t < 0) {
                        return 'Eiskalt (< 0°C)';
                    }
                    if ($t < 10) {
                        return 'Kalt (0–10°C)';
                    }
                    if ($t < 15) {
                        return 'Kühl (10–15°C)';
                    }
                    if ($t < 20) {
                        return 'Mild (15–20°C)';
                    }
                    if ($t < 25) {
                        return 'Warm (20–25°C)';
                    }

                    return 'Heiß (> 25°C)';
                },
                'entity' => 'CalendarEvent',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'windStrength' => [
                'label' => 'Windstärke',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if (!$ce) {
                        return null;
                    }
                    $wd = $ce->getWeatherData();
                    if (!$wd) {
                        return null;
                    }
                    $daily = $wd->getDailyWeatherData();
                    $windMax = $daily['windspeed_10m_max'][0] ?? $daily['wind_speed_10m_max'][0] ?? null;
                    if (null === $windMax) {
                        $hourly = $wd->getHourlyWeatherData();
                        if (is_array($hourly) && !empty($hourly['wind_speed_10m'])) {
                            $windMax = max($hourly['wind_speed_10m']);
                        }
                    }
                    if (null === $windMax || !is_numeric($windMax)) {
                        return null;
                    }
                    $w = (float) $windMax;
                    if ($w < 10) {
                        return 'Windstill (< 10 km/h)';
                    }
                    if ($w < 25) {
                        return 'Leichter Wind (10–25 km/h)';
                    }
                    if ($w < 40) {
                        return 'Mäßiger Wind (25–40 km/h)';
                    }
                    if ($w < 60) {
                        return 'Starker Wind (40–60 km/h)';
                    }

                    return 'Sturm (> 60 km/h)';
                },
                'entity' => 'CalendarEvent',
                'type' => 'string',
                'category' => 'dimension',
            ],
            'cloudCover' => [
                'label' => 'Bewölkung',
                'value' => static function ($event) {
                    $game = $event->getGame();
                    $ce = $game ? $game->getCalendarEvent() : null;
                    if (!$ce) {
                        return null;
                    }
                    $wd = $ce->getWeatherData();
                    if (!$wd) {
                        return null;
                    }
                    $daily = $wd->getDailyWeatherData();
                    $cover = $daily['cloudcover_mean'][0] ?? null;
                    if (null === $cover) {
                        $hourly = $wd->getHourlyWeatherData();
                        if (is_array($hourly) && !empty($hourly['cloudcover'])) {
                            $cover = array_sum($hourly['cloudcover']) / count($hourly['cloudcover']);
                        }
                    }
                    if (null === $cover || !is_numeric($cover)) {
                        return null;
                    }
                    $c = (float) $cover;
                    if ($c < 20) {
                        return 'Wolkenlos (< 20%)';
                    }
                    if ($c < 50) {
                        return 'Leicht bewölkt (20–50%)';
                    }
                    if ($c < 80) {
                        return 'Bewölkt (50–80%)';
                    }

                    return 'Stark bewölkt (> 80%)';
                },
                'entity' => 'CalendarEvent',
                'type' => 'string',
                'category' => 'dimension',
            ],

            // ─── Metrics (Y-Axis / countable values) ─────────────────────

            'goals' => [
                'label' => 'Tore',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['goal', 'penalty_goal', 'freekick_goal', 'header_goal', 'corner_goal', 'cross_goal', 'counter_goal', 'pressing_goal']);
                },
            ],
            'assists' => [
                'label' => 'Torvorlagen',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['assist']);
                },
            ],
            'shots' => [
                'label' => 'Schüsse',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes(
                        $events,
                        [
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
                        ]
                    );
                },
            ],
            'shotAccuracy' => [
                'label' => 'Torschussquote %',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    $allShots = $countByCodes(
                        $events,
                        [
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
                        ]
                    );
                    $goals = $countByCodes(
                        $events,
                        [
                            'goal',
                            'penalty_goal',
                            'freekick_goal',
                            'header_goal',
                            'corner_goal',
                            'cross_goal',
                            'counter_goal',
                            'pressing_goal'
                        ]
                    );
                    if (0 === $allShots) {
                        return 0;
                    }

                    return round(($goals / $allShots) * 100, 1);
                },
            ],
            'yellowCards' => [
                'label' => 'Gelbe Karten',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['yellow_card']);
                },
            ],
            'yellowRedCards' => [
                'label' => 'Gelb-Rote Karten',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['yellow_red_card']);
                },
            ],
            'redCards' => [
                'label' => 'Rote Karten',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['red_card']);
                },
            ],
            'fouls' => [
                'label' => 'Fouls',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes(
                        $events,
                        [
                            'foul',
                            'foul_holding',
                            'foul_push',
                            'foul_shove',
                            'foul_bump',
                            'foul_trip',
                            'foul_kick',
                            'foul_elbow'
                        ]
                    );
                },
            ],
            'dribbles' => [
                'label' => 'Dribblings',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['dribble_success']);
                },
            ],
            'duelsWonPercent' => [
                'label' => 'Zweikampfquote %',
                'category' => 'metric',
                'aggregate' => (static function (array $events) use ($typesByCode) {
                    $wonId = isset($typesByCode['duel_won']) ? $typesByCode['duel_won']->getId() : null;
                    $lostId = isset($typesByCode['duel_lost']) ? $typesByCode['duel_lost']->getId() : null;
                    $won = 0;
                    $lost = 0;
                    foreach ($events as $e) {
                        if (!method_exists($e, 'getGameEventType')) {
                            continue;
                        }
                        $t = $e->getGameEventType();
                        if (!$t) {
                            continue;
                        }
                        $id = $t->getId();
                        $code = $t->getCode();
                        if ((null !== $wonId && $id === $wonId) || 'duel_won' === $code) {
                            ++$won;
                        } elseif ((null !== $lostId && $id === $lostId) || 'duel_lost' === $code) {
                            ++$lost;
                        }
                    }
                    $total = $won + $lost;

                    return 0 === $total ? 0 : round(($won / $total) * 100, 1);
                }),
            ],
            'saves' => [
                'label' => 'Paraden (Torwart)',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['save', 'keeper_hold', 'keeper_punch', 'penalty_save']);
                },
            ],
            'passes' => [
                'label' => 'Pässe',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes(
                        $events,
                        [
                            'pass_normal',
                            'pass_through',
                            'cross',
                            'pass_back',
                            'pass_sideways',
                            'chip_ball',
                            'pass_cut',
                            'long_ball',
                            'switch_play',
                            'header_pass'
                        ]
                    );
                },
            ],
            'tackles' => [
                'label' => 'Tacklings',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['tackle_success']);
                },
            ],
            'interceptions' => [
                'label' => 'Balleroberungen',
                'category' => 'metric',
                'aggregate' => static function (array $events) use ($countByCodes) {
                    return $countByCodes($events, ['interception', 'intercept_cross', 'ball_win']);
                },
            ],

            // ─── PlayerGameStats Metrics (from per-game summary data) ─────────────
            // These fields are read from PlayerGameStats entities, not from GameEvents.
            // The backend detects the 'dataSource' flag and switches the query path.

            'minutesPlayed' => [
                'label' => 'Gespielte Minuten',
                'category' => 'metric',
                'dataSource' => 'playerGameStats',
                'pgsField' => 'minutesPlayed',
            ],
            'distanceCovered' => [
                'label' => 'Laufleistung (Meter)',
                'category' => 'metric',
                'dataSource' => 'playerGameStats',
                'pgsField' => 'distanceCovered',
            ],
            'passesCompleted' => [
                'label' => 'Erfolgreiche Pässe',
                'category' => 'metric',
                'dataSource' => 'playerGameStats',
                'pgsField' => 'passesCompleted',
            ],
            'shotsOnTarget' => [
                'label' => 'Schüsse aufs Tor',
                'category' => 'metric',
                'dataSource' => 'playerGameStats',
                'pgsField' => 'shotsOnTarget',
            ],
            'foulsSuffered' => [
                'label' => 'Erlittene Fouls',
                'category' => 'metric',
                'dataSource' => 'playerGameStats',
                'pgsField' => 'foulsSuffered',
            ],
            'foulsCommittedStats' => [
                'label' => 'Begangene Fouls (Spielstatistik)',
                'category' => 'metric',
                'dataSource' => 'playerGameStats',
                'pgsField' => 'foulsCommitted',
            ],
        ];

        // ─── Augment aliases with metadata ────────────────────────────────
        foreach ($aliases as $k => &$v) {
            $hasValueCallable = is_callable($v['value'] ?? null);
            $v['accessibleFromEvent'] = $hasValueCallable || array_key_exists('field', $v);

            // playerGameStats metrics are read via a dedicated query path and do not
            // aggregate raw GameEvents. Provide a no-op callable so that all metric
            // aliases satisfy the contract (aggregate key + callable).
            if ('metric' === $v['category'] && !isset($v['aggregate']) && isset($v['pgsField'])) {
                $v['aggregate'] = static fn (array $events): float => 0.0;
            }

            // Build normalized path for traversal
            $path = [];
            if (is_string($v['field'] ?? null)) {
                $path[] = $v['field'];
                if (is_string($v['subfield'] ?? null)) {
                    $path[] = $v['subfield'];
                }
            } elseif (is_string($v['subfield'] ?? null)) {
                $path[] = $v['subfield'];
            }
            $v['path'] = $path;

            // joinHint: only Doctrine relations for DB-aggregate LEFT JOINs
            if ('player' === $k) {
                $v['joinHint'] = ['player'];
            } elseif ('team' === $k) {
                $v['joinHint'] = ['team'];
            } elseif ('eventType' === $k) {
                $v['joinHint'] = ['gameEventType'];
            } elseif ('gameDate' === $k || 'month' === $k) {
                $v['joinHint'] = ['game', 'calendarEvent'];
            } elseif ('gameType' === $k) {
                $v['joinHint'] = ['game', 'gameType'];
            } elseif ('position' === $k) {
                $v['joinHint'] = ['player', 'mainPosition'];
            } elseif ('surfaceType' === $k) {
                $v['joinHint'] = ['game', 'location', 'surfaceType'];
            } elseif ('competitionType' === $k) {
                // competitionType is resolved via callable (checks league/cup/tournamentMatch on Game)
                $v['joinHint'] = null;
            } elseif ('homeAway' === $k) {
                // homeAway is resolved via callable, no simple join path
                $v['joinHint'] = null;
            } elseif (in_array($k, ['weatherCondition', 'temperatureRange', 'windStrength', 'cloudCover'], true)) {
                // Weather dimensions are resolved via callable (JSON data), no simple join
                $v['joinHint'] = null;
            } else {
                $v['joinHint'] = null;
            }
        }
        unset($v);

        if (null !== $em) {
            self::$cache = $aliases;
        }

        return $aliases;
    }
}
