<?php

declare(strict_types=1);

namespace App\Tests\Unit\Command;

use App\Command\BackfillSuspensionsCommand;
use App\Entity\CalendarEvent;
use App\Entity\CompetitionCardRule;
use App\Entity\Cup;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\League;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use App\Entity\TournamentMatch;
use App\Repository\CompetitionCardRuleRepository;
use App\Repository\GameEventRepository;
use App\Repository\PlayerSuspensionRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Tester\CommandTester;

#[AllowMockObjectsWithoutExpectations]
class BackfillSuspensionsCommandTest extends TestCase
{
    private GameEventRepository&MockObject $gameEventRepository;
    private PlayerSuspensionRepository&MockObject $suspensionRepository;
    private CompetitionCardRuleRepository&MockObject $cardRuleRepository;
    private EntityManagerInterface&MockObject $em;
    private BackfillSuspensionsCommand $command;
    private CommandTester $commandTester;

    protected function setUp(): void
    {
        $this->gameEventRepository = $this->createMock(GameEventRepository::class);
        $this->suspensionRepository = $this->createMock(PlayerSuspensionRepository::class);
        $this->cardRuleRepository = $this->createMock(CompetitionCardRuleRepository::class);
        $this->em = $this->createMock(EntityManagerInterface::class);

        $this->command = new BackfillSuspensionsCommand(
            $this->gameEventRepository,
            $this->suspensionRepository,
            $this->cardRuleRepository,
            $this->em,
        );

        $this->commandTester = new CommandTester($this->command);
    }

    // ── Hilfsmethoden ─────────────────────────────────────────────────────────

    private function makePlayer(int $id = 1, string $name = 'Test Spieler'): Player
    {
        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn($id);
        $player->method('getFullName')->willReturn($name);

        return $player;
    }

    private function makeGame(
        ?League $league = null,
        ?Cup $cup = null,
        ?TournamentMatch $tournamentMatch = null,
        ?CalendarEvent $calendarEvent = null,
        int $id = 100,
    ): Game {
        $game = $this->createMock(Game::class);
        $game->method('getId')->willReturn($id);
        $game->method('getLeague')->willReturn($league);
        $game->method('getCup')->willReturn($cup);
        $game->method('getTournamentMatch')->willReturn($tournamentMatch);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);

        return $game;
    }

    private function makeLeague(int $id = 10): League
    {
        $league = $this->createMock(League::class);
        $league->method('getId')->willReturn($id);

        return $league;
    }

    private function makeCalendarEvent(DateTimeImmutable $date): CalendarEvent
    {
        $ce = $this->createMock(CalendarEvent::class);
        $ce->method('getStartDate')->willReturn($date);

        return $ce;
    }

    private function makeGameEvent(string $code, Player $player, Game $game): GameEvent
    {
        $type = $this->createMock(GameEventType::class);
        $type->method('getCode')->willReturn($code);

        $event = $this->createMock(GameEvent::class);
        $event->method('getPlayer')->willReturn($player);
        $event->method('getGame')->willReturn($game);
        $event->method('getGameEventType')->willReturn($type);

        return $event;
    }

    private function makeRule(
        int $yellowSuspensionThreshold = 5,
        int $suspensionGames = 1,
        int $redCardSuspensionGames = 1,
        int $yellowRedCardSuspensionGames = 1,
        bool $resetAfterSuspension = true,
    ): CompetitionCardRule {
        $rule = $this->createMock(CompetitionCardRule::class);
        $rule->method('getYellowSuspensionThreshold')->willReturn($yellowSuspensionThreshold);
        $rule->method('getSuspensionGames')->willReturn($suspensionGames);
        $rule->method('getRedCardSuspensionGames')->willReturn($redCardSuspensionGames);
        $rule->method('getYellowRedCardSuspensionGames')->willReturn($yellowRedCardSuspensionGames);
        $rule->method('isResetAfterSuspension')->willReturn($resetAfterSuspension);

        return $rule;
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    public function testDryRunDoesNotPersistAnything(): void
    {
        $player = $this->makePlayer();
        $game = $this->makeGame(league: $this->makeLeague());
        $event = $this->makeGameEvent('red_card', $player, $game);

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn([$event]);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($this->makeRule());
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn(null);

        // Im Dry-Run: KEIN persist, KEIN flush
        $this->em->expects($this->never())->method('persist');
        $this->em->expects($this->never())->method('flush');

        $this->commandTester->execute(['--dry-run' => true]);

        $this->assertSame(0, $this->commandTester->getStatusCode());
        $this->assertStringContainsString('1 Sperre(n) erstellt', $this->commandTester->getDisplay());
    }

    public function testRedCardEventCreatesSuspension(): void
    {
        $player = $this->makePlayer();
        $game = $this->makeGame(league: $this->makeLeague());
        $event = $this->makeGameEvent('red_card', $player, $game);

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn([$event]);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($this->makeRule(redCardSuspensionGames: 1));
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn(null);

        $this->em->expects($this->once())->method('persist')
            ->with($this->callback(function (PlayerSuspension $s): bool {
                return PlayerSuspension::REASON_RED_CARD === $s->getReason()
                    && 'league' === $s->getCompetitionType();
            }));

        $this->commandTester->execute([]);

        $this->assertSame(0, $this->commandTester->getStatusCode());
        $this->assertStringContainsString('1 Sperre(n) erstellt', $this->commandTester->getDisplay());
    }

    public function testYellowRedCardEventCreatesSuspension(): void
    {
        $player = $this->makePlayer();
        $game = $this->makeGame(league: $this->makeLeague());
        $event = $this->makeGameEvent('yellow_red_card', $player, $game);

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn([$event]);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($this->makeRule(yellowRedCardSuspensionGames: 2));
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn(null);

        $persisted = null;
        $this->em->method('persist')->willReturnCallback(function ($entity) use (&$persisted): void {
            $persisted = $entity;
        });

        $this->commandTester->execute([]);

        $this->assertInstanceOf(PlayerSuspension::class, $persisted);
        $this->assertSame(PlayerSuspension::REASON_YELLOW_RED_CARD, $persisted->getReason());
        $this->assertSame(2, $persisted->getGamesSuspended());
    }

    public function testYellowCardsAtThresholdCreateSuspension(): void
    {
        $player = $this->makePlayer();
        $ce = $this->makeCalendarEvent(new DateTimeImmutable('2024-09-01'));
        $rule = $this->makeRule(yellowSuspensionThreshold: 3, suspensionGames: 1);

        $events = [];
        for ($i = 1; $i <= 3; ++$i) {
            $game = $this->makeGame(league: $this->makeLeague(), calendarEvent: $ce, id: $i);
            $events[] = $this->makeGameEvent('yellow_card', $player, $game);
        }

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn($events);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        // Noch keine Sperre vorhanden
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn(null);

        $persisted = null;
        $this->em->method('persist')->willReturnCallback(function ($entity) use (&$persisted): void {
            $persisted = $entity;
        });

        $this->commandTester->execute([]);

        $this->assertInstanceOf(PlayerSuspension::class, $persisted);
        $this->assertSame(PlayerSuspension::REASON_YELLOW_CARDS, $persisted->getReason());
        $this->assertStringContainsString('1 Sperre(n) erstellt', $this->commandTester->getDisplay());
    }

    public function testYellowCardCountResetsAfterSuspensionIfResetEnabled(): void
    {
        // Spieler bekommt 3 Gelbe (Sperre), dann 2 weitere → Threshold=3, resetAfterSuspension=true.
        // Erwartet: 1 Sperre (nach 3 Gelben), KEINE zweite Sperre (nur 2 nach Reset).
        $player = $this->makePlayer();
        $ce = $this->makeCalendarEvent(new DateTimeImmutable('2024-09-01'));
        $rule = $this->makeRule(yellowSuspensionThreshold: 3, suspensionGames: 1, resetAfterSuspension: true);

        $events = [];
        for ($i = 1; $i <= 5; ++$i) {
            $game = $this->makeGame(league: $this->makeLeague(), calendarEvent: $ce, id: $i);
            $events[] = $this->makeGameEvent('yellow_card', $player, $game);
        }

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn($events);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($rule);
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn(null);

        $persistCount = 0;
        $this->em->method('persist')->willReturnCallback(function () use (&$persistCount): void {
            ++$persistCount;
        });

        $this->commandTester->execute([]);

        // Nur 1 Sperre: nach dem 3. Gelb; das 4. und 5. Gelb starten den Zähler neu (2 < 3)
        $this->assertSame(1, $persistCount);
        $this->assertStringContainsString('1 Sperre(n) erstellt', $this->commandTester->getDisplay());
    }

    public function testAlreadyExistingSuspensionIsSkipped(): void
    {
        $player = $this->makePlayer();
        $game = $this->makeGame(league: $this->makeLeague());
        $event = $this->makeGameEvent('red_card', $player, $game);

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn([$event]);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($this->makeRule());
        // Sperre existiert bereits
        $existingSuspension = $this->createMock(PlayerSuspension::class);
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn($existingSuspension);

        $this->em->expects($this->never())->method('persist');

        $this->commandTester->execute([]);

        $this->assertSame(0, $this->commandTester->getStatusCode());
        $this->assertStringContainsString('0 Sperre(n) erstellt', $this->commandTester->getDisplay());
        $this->assertStringContainsString('1 übersprungen', $this->commandTester->getDisplay());
    }

    public function testCommandIsIdempotentWhenRunTwice(): void
    {
        // Zweiter Lauf: alle Sperren existieren bereits → 0 neu erstellt.
        $player = $this->makePlayer();
        $game = $this->makeGame(league: $this->makeLeague());
        $events = [
            $this->makeGameEvent('red_card', $player, $game),
            $this->makeGameEvent('yellow_red_card', $player, $game),
        ];

        $this->gameEventRepository->method('findAllCardEventsChronological')->willReturn($events);
        $this->cardRuleRepository->method('findApplicableRule')->willReturn($this->makeRule());
        $existing = $this->createMock(PlayerSuspension::class);
        $this->suspensionRepository->method('findByTriggerGameAndReason')->willReturn($existing);

        $this->em->expects($this->never())->method('persist');

        $this->commandTester->execute([]);

        $this->assertStringContainsString('0 Sperre(n) erstellt', $this->commandTester->getDisplay());
        $this->assertStringContainsString('2 übersprungen', $this->commandTester->getDisplay());
    }
}
