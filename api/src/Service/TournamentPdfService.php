<?php

namespace App\Service;

use App\Entity\Tournament;
use DateTimeImmutable;
use DateTimeInterface;
use Dompdf\Dompdf;
use Dompdf\Options;
use Twig\Environment;

class TournamentPdfService
{
    public function __construct(
        private Environment $twig,
        private string $projectDir,
    ) {
    }

    /**
     * Generate a tournament schedule PDF and return the binary content.
     *
     * @param int[] $userTeamIds
     */
    public function generatePdf(Tournament $tournament, array $userTeamIds = []): string
    {
        $data = $this->buildTemplateData($tournament, $userTeamIds);

        $html = $this->twig->render('pdf/tournament_schedule.html.twig', $data);

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'Helvetica');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return (string) $dompdf->output();
    }

    /**
     * Build all data needed for the Twig template.
     *
     * @param int[] $userTeamIds
     *
     * @return array<string, mixed>
     */
    private function buildTemplateData(Tournament $tournament, array $userTeamIds): array
    {
        $ce = $tournament->getCalendarEvent();
        $location = $ce?->getLocation();

        // Status
        $now = new DateTimeImmutable();
        $status = 'upcoming';
        if ($ce) {
            $start = $ce->getStartDate();
            $end = $ce->getEndDate();
            if ($start && $end && $now >= $start && $now <= $end) {
                $status = 'running';
            } elseif ($start && $start <= $now) {
                $status = 'finished';
            }
        }

        $statusLabels = [
            'upcoming' => 'Anstehend',
            'running' => 'Läuft',
            'finished' => 'Abgeschlossen',
        ];

        // Date string
        $dateString = '';
        if ($ce?->getStartDate()) {
            $dateString = $this->formatDateNice($ce->getStartDate());
            $dateString .= ', ' . $ce->getStartDate()->format('H:i');
            if ($ce->getEndDate()) {
                $dateString .= ' - ' . $ce->getEndDate()->format('H:i');
            }
            $dateString .= ' Uhr';
        }

        // Settings
        $settings = $tournament->getSettings() ?? [];
        $settingsParts = [];
        if (!empty($settings['roundDuration'])) {
            $settingsParts[] = $settings['roundDuration'] . ' Min. / Halbzeit';
        }
        if (!empty($settings['gameMode'])) {
            $settingsParts[] = $settings['gameMode'];
        }
        if (!empty($settings['tournamentType'])) {
            $settingsParts[] = $settings['tournamentType'];
        }
        if (!empty($settings['numberOfGroups'])) {
            $settingsParts[] = $settings['numberOfGroups'] . ' Gruppen';
        }

        // Teams
        $teams = [];
        $groups = [];
        foreach ($tournament->getTeams() as $tt) {
            $team = $tt->getTeam();
            $teamData = [
                'id' => $tt->getId(),
                'teamId' => $team->getId(),
                'name' => $team->getName(),
                'seed' => $tt->getSeed(),
                'groupKey' => $tt->getGroupKey(),
            ];
            $teams[] = $teamData;

            if ($tt->getGroupKey()) {
                $groups[$tt->getGroupKey()][] = $teamData;
            }
        }
        ksort($groups);

        // Derive teams from matches if none explicitly registered
        $teamCount = count($teams);
        if (0 === $teamCount) {
            $seen = [];
            foreach ($tournament->getMatches() as $match) {
                $home = $match->getHomeTeam();
                $away = $match->getAwayTeam();
                if ($home && !isset($seen[$home->getId()])) {
                    $seen[$home->getId()] = true;
                    $teams[] = [
                        'id' => 0,
                        'teamId' => $home->getId(),
                        'name' => $home->getName(),
                        'seed' => null,
                        'groupKey' => null,
                    ];
                }
                if ($away && !isset($seen[$away->getId()])) {
                    $seen[$away->getId()] = true;
                    $teams[] = [
                        'id' => 0,
                        'teamId' => $away->getId(),
                        'name' => $away->getName(),
                        'seed' => null,
                        'groupKey' => null,
                    ];
                }
            }
            $teamCount = count($teams);
        }

        // Codes that must NOT be counted even though they contain 'goal'
        $nonGoalCodes = ['offside_goal', 'var_goal_denied', 'own_goal_attempt'];

        // Matches grouped by stage
        $matchesByStage = [];
        foreach ($tournament->getMatches() as $tournamentMatch) {
            $game = $tournamentMatch->getGame();
            $homeTeam = $tournamentMatch->getHomeTeam();
            $awayTeam = $tournamentMatch->getAwayTeam();

            $homeScore = null;
            $awayScore = null;
            if ($game) {
                $homeScore = 0;
                $awayScore = 0;
                foreach ($game->getGameEvents() as $ge) {
                    $geType = $ge->getGameEventType();
                    if (null === $geType) {
                        continue;
                    }
                    $code = $geType->getCode();
                    if ('own_goal' === $code) {
                        if ($ge->getTeam() === $game->getHomeTeam()) {
                            ++$awayScore;
                        } elseif ($ge->getTeam() === $game->getAwayTeam()) {
                            ++$homeScore;
                        }
                    } elseif (!in_array($code, $nonGoalCodes, true) && str_contains($code, 'goal')) {
                        if ($ge->getTeam() === $game->getHomeTeam()) {
                            ++$homeScore;
                        } elseif ($ge->getTeam() === $game->getAwayTeam()) {
                            ++$awayScore;
                        }
                    }
                }
            }

            $hasScore = null !== $homeScore && null !== $awayScore;
            $stage = $tournamentMatch->getStage() ?: 'Sonstige';

            $matchesByStage[$stage][] = [
                'homeTeamName' => $homeTeam?->getName() ?? 'TBD',
                'awayTeamName' => $awayTeam?->getName() ?? 'TBD',
                'homeTeamId' => $homeTeam?->getId(),
                'awayTeamId' => $awayTeam?->getId(),
                'time' => $tournamentMatch->getScheduledAt()?->format('H:i'),
                'hasScore' => $hasScore,
                'scoreDisplay' => $hasScore ? $homeScore . ' : ' . $awayScore : '– : –',
            ];
        }

        // Logo as base64 data URI (DOMPDF can't load filesystem paths directly)
        $logoDataUri = '';
        $logoPath = $this->projectDir . '/public/images/icon.png';
        if (file_exists($logoPath)) {
            $logoData = file_get_contents($logoPath);
            if (false !== $logoData) {
                $logoDataUri = 'data:image/png;base64,' . base64_encode($logoData);
            }
        }

        // Generated at
        $now = new DateTimeImmutable();
        $generatedAt = $now->format('d.m.Y') . ' um ' . $now->format('H:i') . ' Uhr';

        return [
            'tournament' => $tournament,
            'status_label' => $statusLabels[$status],
            'date_string' => $dateString,
            'location_name' => $location?->getName() ?? '',
            'settings_parts' => $settingsParts,
            'teams' => $teams,
            'team_count' => $teamCount,
            'groups' => $groups,
            'matches_by_stage' => $matchesByStage,
            'matches' => $tournament->getMatches(),
            'user_team_ids' => $userTeamIds,
            'logo_data_uri' => $logoDataUri,
            'generated_at' => $generatedAt,
        ];
    }

    private function formatDateNice(DateTimeInterface $date): string
    {
        $days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        $months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
        ];

        return sprintf(
            '%s, %d. %s %d',
            $days[(int) $date->format('w')],
            (int) $date->format('j'),
            $months[(int) $date->format('n') - 1],
            (int) $date->format('Y')
        );
    }
}
