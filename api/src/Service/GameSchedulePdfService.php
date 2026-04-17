<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Game;
use App\Entity\Team;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Dompdf\Dompdf;
use Dompdf\Options;
use Twig\Environment;

/**
 * Generates a printable PDF game schedule for a given team and season.
 *
 * Round labels are resolved as follows (in priority order):
 *   1. If game.round is set: use it verbatim (e.g. "Halbfinale", "1. Runde", "13").
 *   2. Ligaspiel / Nachholspiel with no round: auto-number sequentially per league ("1.", "2.", …).
 *   3. Testspiel / Freundschaftsspiel / Trainingseinheit: no round column, show type name.
 *   4. Everything else: show game type name.
 */
class GameSchedulePdfService
{
    /** Liga types that use automatic sequential Spieltag numbering. */
    private const LIGA_TYPES = ['Ligaspiel', 'Nachholspiel'];

    /** Types where no round label is meaningful (just show type name). */
    private const NO_ROUND_TYPES = ['Testspiel', 'Freundschaftsspiel', 'Trainingseinheit', 'Internes Spiel'];

    public function __construct(
        private readonly Environment $twig,
        private readonly EntityManagerInterface $em,
        private readonly string $projectDir,
    ) {
    }

    public function generateForTeam(Team $team, int $season): string
    {
        $data = $this->buildTemplateData($team, $season);

        $html = $this->twig->render('pdf/game_schedule.html.twig', $data);

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
     * Build the template data array exposed to the Twig template.
     *
     * @return array<string, mixed>
     */
    public function buildTemplateData(Team $team, int $season): array
    {
        $seasonStart = new DateTimeImmutable("{$season}-07-01");
        $seasonEnd = new DateTimeImmutable(($season + 1) . '-06-30 23:59:59');

        $games = $this->loadGames($team, $seasonStart, $seasonEnd);

        $leagueCounters = [];
        $rows = [];

        foreach ($games as $game) {
            $calendarEvent = $game->getCalendarEvent();
            $date = $calendarEvent?->getStartDate();

            $roundLabel = $this->resolveRoundLabel($game, $leagueCounters);

            $homeTeam = $game->getHomeTeam();
            $awayTeam = $game->getAwayTeam();

            $hasScore = $game->isFinished()
                && null !== $game->getHomeScore()
                && null !== $game->getAwayScore();

            $rows[] = [
                'round_label' => $roundLabel,
                'date' => $date,
                'home_team_name' => $homeTeam?->getName() ?? 'TBD',
                'away_team_name' => $awayTeam?->getName() ?? 'TBD',
                'is_home' => $homeTeam?->getId() === $team->getId(),
                'kick_off' => $date ? $date->format('H:i') : null,
                'has_score' => $hasScore,
                'home_score' => $hasScore ? $game->getHomeScore() : null,
                'away_score' => $hasScore ? $game->getAwayScore() : null,
                'is_finished' => $game->isFinished(),
                'game_type_name' => $game->getGameType()->getName(),
                'league_name' => $game->getLeague()?->getName(),
                'cup_name' => $game->getCup()?->getName(),
            ];
        }

        $logoDataUri = $this->loadLogoDataUri();

        $now = new DateTimeImmutable();

        return [
            'team' => $team,
            'season' => $season,
            'season_display' => $season . '/' . substr((string) ($season + 1), 2),
            'rows' => $rows,
            'logo_data_uri' => $logoDataUri,
            'generated_at' => $now->format('d.m.Y') . ' um ' . $now->format('H:i') . ' Uhr',
        ];
    }

    /**
     * @return Game[]
     */
    protected function loadGames(Team $team, DateTimeInterface $seasonStart, DateTimeInterface $seasonEnd): array
    {
        return $this->em->createQuery(
            'SELECT g, gt, ce, ht, at, loc, lg, cup
             FROM App\Entity\Game g
             INNER JOIN g.gameType gt
             LEFT JOIN g.calendarEvent ce
             LEFT JOIN g.homeTeam ht
             LEFT JOIN g.awayTeam at
             LEFT JOIN g.location loc
             LEFT JOIN g.league lg
             LEFT JOIN g.cup cup
             WHERE (g.homeTeam = :team OR g.awayTeam = :team)
               AND ce.startDate >= :seasonStart
               AND ce.startDate <= :seasonEnd
             ORDER BY ce.startDate ASC'
        )
            ->setParameter('team', $team)
            ->setParameter('seasonStart', $seasonStart)
            ->setParameter('seasonEnd', $seasonEnd)
            ->getResult();
    }

    /**
     * Resolves the human-readable round label for a single game.
     *
     * @param array<string, int> $leagueCounters mutable counter map, keyed by league key
     */
    public function resolveRoundLabel(Game $game, array &$leagueCounters): string
    {
        // 1. Explicit round takes highest precedence
        $round = $game->getRound();
        if (null !== $round && '' !== $round) {
            return $round;
        }

        $typeName = $game->getGameType()->getName();

        // 2. Liga: auto-sequential counter per league
        if (in_array($typeName, self::LIGA_TYPES, true)) {
            $leagueId = $game->getLeague()?->getId();
            $key = 'liga_' . ($leagueId ?? 'no_league');
            $leagueCounters[$key] = ($leagueCounters[$key] ?? 0) + 1;

            return $leagueCounters[$key] . '.';
        }

        // 3. Test / Friendly: just show type name, no round number
        if (in_array($typeName, self::NO_ROUND_TYPES, true)) {
            return $typeName;
        }

        // 4. Fallback: type name
        return $typeName;
    }

    private function loadLogoDataUri(): string
    {
        $logoPath = $this->projectDir . '/public/images/icon.png';
        if (!file_exists($logoPath)) {
            return '';
        }
        $logoData = file_get_contents($logoPath);
        if (false === $logoData) {
            return '';
        }

        return 'data:image/png;base64,' . base64_encode($logoData);
    }
}
