<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\Team;
use App\Repository\GameEventRepository;
use App\Service\GameScoreSyncService;
use App\Service\GoalCountingService;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

final class GameScoreSyncServiceTest extends TestCase
{
    public function testSyncCalculatesAndPersistsBothScores(): void
    {
        $home = new Team();
        $away = new Team();
        $game = (new Game())->setHomeTeam($home)->setAwayTeam($away);
        (new ReflectionProperty($game, 'id'))->setValue($game, 42);

        $goal = (new GameEventType())->setCode('goal');
        $ownGoal = (new GameEventType())->setCode('own_goal');
        $events = [
            (new GameEvent())->setGame($game)->setTeam($home)->setGameEventType($goal),
            (new GameEvent())->setGame($game)->setTeam($away)->setGameEventType($ownGoal),
        ];

        $repository = $this->createMock(GameEventRepository::class);
        $repository->expects(self::once())
            ->method('findAllGameEvents')
            ->with($game)
            ->willReturn($events);

        $connection = $this->createMock(Connection::class);
        $connection->expects(self::once())
            ->method('update')
            ->with('games', ['home_score' => 2, 'away_score' => 0], ['id' => 42]);

        $service = new GameScoreSyncService($repository, new GoalCountingService(), $connection);

        self::assertSame(['home' => 2, 'away' => 0], $service->sync($game));
    }
}
