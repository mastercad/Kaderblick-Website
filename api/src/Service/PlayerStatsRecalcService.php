<?php

namespace App\Service;

use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerGameStats;
use App\Repository\GameEventRepository;
use App\Repository\PlayerRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Berechnet die Spielminuten aller am Spiel beteiligten Spieler
 * aus matchPlan (Startelf) + Substitutions (Ein-/Auswechslungen) und
 * persistiert das Ergebnis in player_game_stats.
 *
 * Diese Klasse ist idempotent: sie löscht immer zuerst alle bestehenden
 * Einträge für das Spiel und schreibt sie neu – damit ist ein mehrfacher
 * Aufruf (z.B. durch den Messenger-Worker) immer sicher.
 */
class PlayerStatsRecalcService
{
    public function __construct(
        private EntityManagerInterface $em,
        private PlayerRepository $playerRepository,
        private GameEventRepository $gameEventRepository,
    ) {
    }

    /**
     * Berechnet und persistiert player_game_stats für ein Spiel.
     * Kann direkt aufgerufen werden (z.B. CSV-Import) oder vom Messenger-Handler.
     *
     * Bedingung: Das Game-Objekt muss vollständig geladen sein (matchPlan + substitutions).
     */
    public function recalcForGame(Game $game): void
    {
        // 1. Alle bisherigen Stats für dieses Spiel löschen (atomar, per DQL)
        $this->em->createQuery(
            'DELETE FROM App\Entity\PlayerGameStats pgs WHERE pgs.game = :game'
        )
            ->setParameter('game', $game)
            ->execute();

        // Keine Stats für laufende/geplante Spiele – nur abgeschlossene Spiele zählen
        if (!$game->isFinished()) {
            return;
        }

        // 2. Gesamtspieldauer ermitteln
        $totalMinutes = $game->getHalfDuration() * 2
            + ($game->getFirstHalfExtraTime() ?? 0)
            + ($game->getSecondHalfExtraTime() ?? 0);

        // Fallback: Wenn keine Halbzeit-Infos vorhanden sind
        if (0 === $totalMinutes) {
            $totalMinutes = 90;
        }

        // 3. Teilnahme-Map aufbauen: playerId => ['from' => int, 'to' => int]
        //    Ohne Matchplan (Aufstellung) sind keine sinnvollen Stats berechenbar.
        $matchPlan = $game->getMatchPlan();
        if (!is_array($matchPlan) || empty($matchPlan['phases'])) {
            return;
        }

        /** @var array<int, array{from: int, to: int}> $participants */
        $participants = [];

        // 3a. Startelf aus matchPlan extrahieren
        foreach ($matchPlan['phases'] as $phase) {
            if (($phase['sourceType'] ?? '') === 'start') {
                foreach ($phase['players'] as $mp) {
                    if (!empty($mp['isRealPlayer']) && !empty($mp['playerId'])) {
                        $participants[(int) $mp['playerId']] = [
                            'from' => 0,
                            'to' => $totalMinutes,
                        ];
                    }
                }
                break; // nur die erste 'start'-Phase
            }
        }

        // 3b. Auswechslungen aus game_events verarbeiten (chronologisch nach timestamp sortiert)
        $calendarEvent = $game->getCalendarEvent();
        $substitutionEvents = $this->gameEventRepository->findSubstitutions($game);

        foreach ($substitutionEvents as $event) {
            $code = $event->getGameEventType()?->getCode() ?? '';

            $secondsOffset = null !== $calendarEvent
                ? $event->getTimestamp()->getTimestamp() - $calendarEvent->getStartDate()->getTimestamp()
                : 0;
            $minute = (int) round($secondsOffset / 60);

            $player = $event->getPlayer();
            $relatedPlayer = $event->getRelatedPlayer();

            if (in_array($code, ['substitution', 'substitution_out', 'substitution_injury'], true)) {
                // Hauptspieler geht RAUS
                if (null !== $player) {
                    $outId = $player->getId();
                    if (isset($participants[$outId])) {
                        $participants[$outId]['to'] = $minute;
                    } else {
                        $participants[$outId] = ['from' => 0, 'to' => $minute];
                    }
                }
                // relatedPlayer kommt REIN (gilt für 'substitution', 'substitution_out' UND 'substitution_injury')
                if (null !== $relatedPlayer) {
                    $inId = $relatedPlayer->getId();
                    if (!isset($participants[$inId])) {
                        // Nur setzen wenn noch nicht vorhanden (paired substitution_in-Event hat Vorrang)
                        $participants[$inId] = ['from' => $minute, 'to' => $totalMinutes];
                    }
                }
            } elseif ('substitution_in' === $code) {
                // Hauptspieler kommt REIN
                if (null !== $player) {
                    $inId = $player->getId();
                    $participants[$inId] = ['from' => $minute, 'to' => $totalMinutes];
                }
                // Optionaler relatedPlayer geht RAUS
                if (null !== $relatedPlayer) {
                    $outId = $relatedPlayer->getId();
                    if (isset($participants[$outId])) {
                        $participants[$outId]['to'] = $minute;
                    } else {
                        $participants[$outId] = ['from' => 0, 'to' => $minute];
                    }
                }
            }
        }

        if (empty($participants)) {
            // Keine Daten vorhanden – nichts zu persistieren
            return;
        }

        // 4. Alle relevanten Player in einem Query laden (kein N+1)
        $playerIds = array_keys($participants);
        /** @var Player[] $players */
        $players = $this->playerRepository->findBy(['id' => $playerIds]);
        $playerMap = [];
        foreach ($players as $player) {
            $playerMap[$player->getId()] = $player;
        }

        // 5. PlayerGameStats-Einträge anlegen
        foreach ($participants as $playerId => $interval) {
            $minutesPlayed = max(0, $interval['to'] - $interval['from']);
            if (0 === $minutesPlayed) {
                continue;
            }

            if (!isset($playerMap[$playerId])) {
                continue; // Spieler existiert nicht (mehr)
            }

            $stats = new PlayerGameStats($game, $playerMap[$playerId]);
            $stats->setMinutesPlayed($minutesPlayed);
            $this->em->persist($stats);
        }

        $this->em->flush();
    }
}
