<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Game;
use App\Repository\GameEventRepository;
use App\Repository\GameRepository;
use App\Service\GoalCountingService;
use DateTimeImmutable;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class PublicLiveTickerController extends AbstractController
{
    #[Route('/api/public/live-ticker/{token}', name: 'api_public_live_ticker_show', requirements: ['token' => '[a-f0-9]{48}'], methods: ['GET'])]
    public function show(
        string $token,
        GameRepository $games,
        GameEventRepository $events,
        GoalCountingService $goalCounting,
    ): JsonResponse {
        $game = $games->findOneBy([
            'publicLiveTickerToken' => $token,
            'publicLiveTickerEnabled' => true,
        ]);

        if (!$game instanceof Game) {
            return $this->json(['error' => 'Dieser Liveticker ist nicht verfügbar.'], Response::HTTP_NOT_FOUND);
        }

        $calendarEvent = $game->getCalendarEvent();
        $gameEvents = $events->findAllGameEvents($game);
        $score = $goalCounting->collectScores($gameEvents, $game);
        $start = $calendarEvent?->getStartDate();
        $end = $calendarEvent?->getEndDate();
        $now = new DateTimeImmutable();
        $status = $game->isFinished() ? 'finished' : (($start && $end && $now >= $start && $now <= $end) ? 'live' : 'scheduled');

        $payloadEvents = [];
        foreach (array_reverse($gameEvents) as $event) {
            $eventType = $event->getGameEventType();
            $team = $event->getTeam();
            $minute = $start ? max(0, (int) floor(($event->getTimestamp()->getTimestamp() - $start->getTimestamp()) / 60)) : null;
            $payloadEvents[] = [
                'id' => $event->getId(),
                'minute' => $minute,
                'timestamp' => $event->getTimestamp()->format(DATE_ATOM),
                'type' => [
                    'name' => $eventType?->getName() ?? 'Spielereignis',
                    'code' => $eventType?->getCode() ?? 'event',
                    'icon' => $eventType?->getIcon(),
                    'color' => $eventType?->getColor(),
                ],
                'team' => $team ? [
                    'side' => $team === $game->getHomeTeam() ? 'home' : 'away',
                    'name' => $team->getName(),
                ] : null,
                // Deliberately no player, coach, user, video or permission fields.
                'description' => $event->getDescription(),
            ];
        }

        $response = $this->json([
            'game' => [
                'homeTeam' => ['name' => $game->getHomeTeam()?->getName()],
                'awayTeam' => ['name' => $game->getAwayTeam()?->getName()],
                'homeScore' => $score['home'],
                'awayScore' => $score['away'],
                'status' => $status,
                'startsAt' => $start?->format(DATE_ATOM),
                'endsAt' => $end?->format(DATE_ATOM),
                'isFinished' => $game->isFinished(),
            ],
            'events' => $payloadEvents,
            'updatedAt' => $now->format(DATE_ATOM),
        ]);
        $response->headers->set('Cache-Control', 'no-store, max-age=0');

        return $response;
    }
}
