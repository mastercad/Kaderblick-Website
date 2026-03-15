<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\ReportDefinition;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

class ReportFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            UserFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        $now = new DateTimeImmutable();

        // ------------------------------------------------------------------
        // Report definitions: mix of templates (5) and regular reports (15)
        // Users: admin for templates, lt_user_500-519 for club-specific ones
        // ------------------------------------------------------------------

        /** @var User $adminUser */
        $adminUser = $this->getReference('lt_admin_user', User::class);

        $definitions = [
            // ── Templates (isTemplate = true, owned by admin) ───────────────
            [
                'name' => 'Vorlage: Saisonanalyse',
                'description' => 'Standard-Vorlage für die jährliche Saisonauswertung aller Teams.',
                'isTemplate' => true,
                'user' => $adminUser,
                'config' => [
                    'season' => null,
                    'teamId' => null,
                    'metrics' => ['games_played', 'goals_scored', 'goals_conceded', 'wins', 'draws', 'losses'],
                    'groupBy' => 'team',
                    'chartType' => 'bar',
                ],
                'createdAt' => new DateTimeImmutable('2023-09-01'),
            ],
            [
                'name' => 'Vorlage: Spielerstatistiken',
                'description' => 'Vorlage für individuelle Spielerauswertungen über eine Saison.',
                'isTemplate' => true,
                'user' => $adminUser,
                'config' => [
                    'season' => null,
                    'teamId' => null,
                    'metrics' => ['goals', 'assists', 'yellow_cards', 'red_cards', 'games_played', 'minutes_played'],
                    'groupBy' => 'player',
                    'sortBy' => 'goals',
                    'chartType' => 'table',
                ],
                'createdAt' => new DateTimeImmutable('2023-09-01'),
            ],
            [
                'name' => 'Vorlage: Trainerauswertung',
                'description' => 'Vorlage zur Bewertung der Trainerperformance anhand von Spielergebnissen.',
                'isTemplate' => true,
                'user' => $adminUser,
                'config' => [
                    'season' => null,
                    'coachId' => null,
                    'metrics' => ['wins', 'draws', 'losses', 'goals_scored', 'goals_conceded', 'points'],
                    'groupBy' => 'coach',
                    'chartType' => 'radar',
                ],
                'createdAt' => new DateTimeImmutable('2023-10-15'),
            ],
            [
                'name' => 'Vorlage: Torschützenranking',
                'description' => 'Standard-Torjägerliste für beliebige Teams und Saisons.',
                'isTemplate' => true,
                'user' => $adminUser,
                'config' => [
                    'season' => null,
                    'ageGroup' => null,
                    'metrics' => ['goals', 'penalty_goals', 'freekick_goals', 'header_goals'],
                    'topN' => 20,
                    'chartType' => 'table',
                ],
                'createdAt' => new DateTimeImmutable('2023-10-15'),
            ],
            [
                'name' => 'Vorlage: Heimbilanz vs. Auswärtsbilanz',
                'description' => 'Vergleich der Heim- und Auswärtsleistung eines Teams über eine Saison.',
                'isTemplate' => true,
                'user' => $adminUser,
                'config' => [
                    'season' => null,
                    'teamId' => null,
                    'splitBy' => 'home_away',
                    'metrics' => ['wins', 'draws', 'losses', 'goals_scored', 'goals_conceded'],
                    'chartType' => 'grouped_bar',
                ],
                'createdAt' => new DateTimeImmutable('2024-01-20'),
            ],

            // ── Saison 2023/24 Reports ────────────────────────────────────
            [
                'name' => 'Saisonanalyse 2023/24 – FC Bayern München',
                'description' => 'Auswertung aller Teams des FC Bayern München für die Saison 2023/24.',
                'isTemplate' => false,
                'userRef' => 'lt_user_500',
                'config' => [
                    'season' => '2023/24',
                    'clubId' => 1,
                    'metrics' => ['games_played', 'goals_scored', 'goals_conceded', 'wins', 'draws', 'losses', 'points'],
                    'groupBy' => 'team',
                    'chartType' => 'bar',
                ],
                'createdAt' => new DateTimeImmutable('2024-07-01'),
            ],
            [
                'name' => 'Torschützenliste Senioren 2023/24',
                'description' => 'Top-Torschützen aller Seniorenteams in der Saison 2023/24.',
                'isTemplate' => false,
                'userRef' => 'lt_user_501',
                'config' => [
                    'season' => '2023/24',
                    'ageGroup' => 'Senioren',
                    'metrics' => ['goals', 'penalty_goals', 'header_goals'],
                    'topN' => 25,
                    'chartType' => 'table',
                ],
                'createdAt' => new DateTimeImmutable('2024-07-10'),
            ],
            [
                'name' => 'A-Junioren Spielerstatistiken 2023/24',
                'description' => 'Individuelle Statistiken aller A-Junioren-Spieler der Saison 2023/24.',
                'isTemplate' => false,
                'userRef' => 'lt_user_502',
                'config' => [
                    'season' => '2023/24',
                    'ageGroup' => 'A-Junioren',
                    'metrics' => ['goals', 'assists', 'yellow_cards', 'red_cards', 'games_played'],
                    'groupBy' => 'player',
                    'sortBy' => 'goals',
                    'chartType' => 'table',
                ],
                'createdAt' => new DateTimeImmutable('2024-07-10'),
            ],
            [
                'name' => 'Kartenstatistiken Saison 2023/24',
                'description' => 'Anzahl gelber und roter Karten je Team in der Saison 2023/24.',
                'isTemplate' => false,
                'userRef' => 'lt_user_503',
                'config' => [
                    'season' => '2023/24',
                    'metrics' => ['yellow_cards', 'yellow_red_cards', 'red_cards'],
                    'groupBy' => 'team',
                    'chartType' => 'stacked_bar',
                ],
                'createdAt' => new DateTimeImmutable('2024-07-15'),
            ],
            [
                'name' => 'Spielverlauf-Analyse BVB Senioren I 2023/24',
                'description' => 'Zeitpunkte der Tore und Karten in allen Spielen des BVB Senioren I.',
                'isTemplate' => false,
                'userRef' => 'lt_user_504',
                'config' => [
                    'season' => '2023/24',
                    'teamId' => 7,
                    'metrics' => ['goals_by_minute', 'cards_by_minute', 'substitutions_by_minute'],
                    'minuteBucket' => 15,
                    'chartType' => 'timeline',
                ],
                'createdAt' => new DateTimeImmutable('2024-07-20'),
            ],

            // ── Saison 2024/25 Reports ────────────────────────────────────
            [
                'name' => 'Saisonanalyse 2024/25 – Bayer 04 Leverkusen',
                'description' => 'Vollständige Auswertung der Saison 2024/25 für Bayer 04 Leverkusen.',
                'isTemplate' => false,
                'userRef' => 'lt_user_505',
                'config' => [
                    'season' => '2024/25',
                    'clubId' => 3,
                    'metrics' => ['games_played', 'goals_scored', 'goals_conceded', 'wins', 'draws', 'losses', 'points'],
                    'groupBy' => 'team',
                    'chartType' => 'bar',
                ],
                'createdAt' => new DateTimeImmutable('2025-02-01'),
            ],
            [
                'name' => 'Team-Performance Monitor 2024/25',
                'description' => 'Laufende Performanceübersicht aller Teams in der Saison 2024/25.',
                'isTemplate' => false,
                'userRef' => 'lt_user_506',
                'config' => [
                    'season' => '2024/25',
                    'metrics' => ['points', 'goals_scored', 'goals_conceded', 'goal_diff'],
                    'groupBy' => 'team',
                    'topN' => 10,
                    'chartType' => 'line',
                    'updateFrequency' => 'weekly',
                ],
                'createdAt' => new DateTimeImmutable('2025-02-01'),
            ],
            [
                'name' => 'Frauen-Teams Vergleich 2024/25',
                'description' => 'Vergleich der Leistungen aller Frauenteams in der Saison 2024/25.',
                'isTemplate' => false,
                'userRef' => 'lt_user_507',
                'config' => [
                    'season' => '2024/25',
                    'gender' => 'female',
                    'metrics' => ['games_played', 'wins', 'draws', 'losses', 'goals_scored'],
                    'groupBy' => 'team',
                    'chartType' => 'radar',
                ],
                'createdAt' => new DateTimeImmutable('2025-02-10'),
            ],
            [
                'name' => 'Leihtransfer-Report 2024/25',
                'description' => 'Übersicht aller aktiven Leihspieler und deren Statistiken in der Saison 2024/25.',
                'isTemplate' => false,
                'userRef' => 'lt_user_508',
                'config' => [
                    'season' => '2024/25',
                    'assignmentType' => 'leihgabe',
                    'metrics' => ['goals', 'assists', 'games_played', 'yellow_cards'],
                    'groupBy' => 'player',
                    'chartType' => 'table',
                ],
                'createdAt' => new DateTimeImmutable('2025-03-01'),
            ],
            [
                'name' => 'Gegneranalyse Top-5 Teams 2024/25',
                'description' => 'Detaillierte Gegneranalyse der fünf stärksten Teams der Saison 2024/25.',
                'isTemplate' => false,
                'userRef' => 'lt_user_509',
                'config' => [
                    'season' => '2024/25',
                    'topTeams' => 5,
                    'metrics' => ['goals_scored', 'goals_conceded', 'shots_on_target', 'corners', 'fouls'],
                    'groupBy' => 'team',
                    'chartType' => 'grouped_bar',
                ],
                'createdAt' => new DateTimeImmutable('2025-03-05'),
            ],

            // ── Crosssaison / Mehrjahresvergleiche ─────────────────────────
            [
                'name' => 'Dreijahresvergleich Senioren I – FC Bayern',
                'description' => 'Entwicklung des FC Bayern Senioren I über drei Saisons (2023-2026).',
                'isTemplate' => false,
                'userRef' => 'lt_user_510',
                'config' => [
                    'seasons' => ['2023/24', '2024/25', '2025/26'],
                    'teamId' => 1,
                    'metrics' => ['points', 'goals_scored', 'goals_conceded', 'wins'],
                    'chartType' => 'multi_line',
                ],
                'createdAt' => new DateTimeImmutable('2025-04-01'),
            ],
            [
                'name' => 'Nachwuchsentwicklung 2023–2026',
                'description' => 'Aufstieg und Wechsel von Nachwuchsspielern über alle Altersgruppen.',
                'isTemplate' => false,
                'userRef' => 'lt_user_511',
                'config' => [
                    'seasons' => ['2023/24', '2024/25', '2025/26'],
                    'ageGroups' => ['C-Junioren', 'B-Junioren', 'A-Junioren', 'Senioren'],
                    'metrics' => ['players_promoted', 'players_transferred', 'games_played'],
                    'chartType' => 'sankey',
                ],
                'createdAt' => new DateTimeImmutable('2025-04-15'),
            ],
            [
                'name' => 'SG-Team Leistungsauswertung 2023–2026',
                'description' => 'Auswertung der Spielgemeinschaften über alle drei Saisons.',
                'isTemplate' => false,
                'userRef' => 'lt_user_512',
                'config' => [
                    'seasons' => ['2023/24', '2024/25', '2025/26'],
                    'teamType' => 'spielgemeinschaft',
                    'metrics' => ['games_played', 'wins', 'draws', 'losses', 'goals_scored', 'goals_conceded'],
                    'groupBy' => 'team',
                    'chartType' => 'bar',
                ],
                'createdAt' => new DateTimeImmutable('2025-05-01'),
            ],
            [
                'name' => 'Trainerbilanz 3-Jahres-Übersicht',
                'description' => 'Vergleich aller Cheftrainer nach Punkteschnitt über drei Saisons.',
                'isTemplate' => false,
                'userRef' => 'lt_user_513',
                'config' => [
                    'seasons' => ['2023/24', '2024/25', '2025/26'],
                    'coachType' => 'Cheftrainer',
                    'metrics' => ['avg_points_per_game', 'win_rate', 'goals_scored_avg', 'goals_conceded_avg'],
                    'sortBy' => 'avg_points_per_game',
                    'topN' => 15,
                    'chartType' => 'table',
                ],
                'createdAt' => new DateTimeImmutable('2025-05-10'),
            ],
            [
                'name' => 'Gesamtranking aller 25 Vereine 2023–2026',
                'description' => 'Kumulierte Punkte und Tordifferenz aller 25 Testvereine über drei Saisons.',
                'isTemplate' => false,
                'userRef' => 'lt_user_514',
                'config' => [
                    'seasons' => ['2023/24', '2024/25', '2025/26'],
                    'scope' => 'all_clubs',
                    'metrics' => ['total_points', 'total_goals_scored', 'total_goals_conceded', 'goal_diff'],
                    'groupBy' => 'club',
                    'sortBy' => 'total_points',
                    'chartType' => 'leaderboard',
                ],
                'createdAt' => new DateTimeImmutable('2025-06-01'),
            ],
        ];

        foreach ($definitions as $data) {
            $report = new ReportDefinition();
            $report->setName($data['name']);
            $report->setDescription($data['description'] ?? null);
            $report->setIsTemplate($data['isTemplate']);
            $report->setConfig($data['config']);
            $report->setCreatedAt($data['createdAt']);
            $report->setUpdatedAt($now);

            if (isset($data['user'])) {
                $report->setUser($data['user']);
            } elseif (isset($data['userRef'])) {
                /** @var User $user */
                $user = $this->getReference($data['userRef'], User::class);
                $report->setUser($user);
            }

            $manager->persist($report);
        }

        $manager->flush();
    }
}
