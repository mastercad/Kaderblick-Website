<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerSuspension;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class PlayerSuspensionTest extends TestCase
{
    private function makePlayer(): Player
    {
        return $this->createMock(Player::class);
    }

    private function makeGame(): Game
    {
        return $this->createMock(Game::class);
    }

    public function testConstructorSetsAllFields(): void
    {
        $player = $this->makePlayer();
        $game = $this->makeGame();

        $suspension = new PlayerSuspension(
            player: $player,
            competitionType: 'league',
            competitionId: 42,
            reason: PlayerSuspension::REASON_YELLOW_CARDS,
            gamesSuspended: 2,
            triggeredByGame: $game,
        );

        $this->assertSame($player, $suspension->getPlayer());
        $this->assertSame('league', $suspension->getCompetitionType());
        $this->assertSame(42, $suspension->getCompetitionId());
        $this->assertSame(PlayerSuspension::REASON_YELLOW_CARDS, $suspension->getReason());
        $this->assertSame(2, $suspension->getGamesSuspended());
        $this->assertSame($game, $suspension->getTriggeredByGame());
        $this->assertSame(0, $suspension->getGamesServed());
        $this->assertTrue($suspension->isActive());
    }

    public function testConstructorWithNullableFields(): void
    {
        $player = $this->makePlayer();

        $suspension = new PlayerSuspension(
            player: $player,
            competitionType: 'friendly',
            competitionId: null,
            reason: PlayerSuspension::REASON_RED_CARD,
            gamesSuspended: 1,
        );

        $this->assertNull($suspension->getCompetitionId());
        $this->assertNull($suspension->getTriggeredByGame());
    }

    public function testIsActiveByDefault(): void
    {
        $suspension = new PlayerSuspension(
            player: $this->makePlayer(),
            competitionType: 'league',
            competitionId: 1,
            reason: PlayerSuspension::REASON_RED_CARD,
            gamesSuspended: 1,
        );

        $this->assertTrue($suspension->isActive());
    }

    public function testSetGamesServedDeactivatesWhenFull(): void
    {
        $suspension = new PlayerSuspension(
            player: $this->makePlayer(),
            competitionType: 'league',
            competitionId: 1,
            reason: PlayerSuspension::REASON_YELLOW_CARDS,
            gamesSuspended: 2,
        );

        $suspension->setGamesServed(1);
        $this->assertTrue($suspension->isActive(), 'Still active after 1 of 2 games served');
        $this->assertSame(1, $suspension->getRemainingGames());

        $suspension->setGamesServed(2);
        $this->assertFalse($suspension->isActive(), 'Deactivated after all games served');
        $this->assertSame(0, $suspension->getRemainingGames());
    }

    public function testSetGamesServedDeactivatesWhenExceeded(): void
    {
        $suspension = new PlayerSuspension(
            player: $this->makePlayer(),
            competitionType: 'cup',
            competitionId: null,
            reason: PlayerSuspension::REASON_RED_CARD,
            gamesSuspended: 1,
        );

        $suspension->setGamesServed(5);
        $this->assertFalse($suspension->isActive());
        $this->assertSame(0, $suspension->getRemainingGames());
    }

    public function testGetRemainingGames(): void
    {
        $suspension = new PlayerSuspension(
            player: $this->makePlayer(),
            competitionType: 'league',
            competitionId: null,
            reason: PlayerSuspension::REASON_YELLOW_CARDS,
            gamesSuspended: 3,
        );

        $this->assertSame(3, $suspension->getRemainingGames());

        $suspension->setGamesServed(1);
        $this->assertSame(2, $suspension->getRemainingGames());

        $suspension->setGamesServed(3);
        $this->assertSame(0, $suspension->getRemainingGames());
    }

    public function testSetIsActive(): void
    {
        $suspension = new PlayerSuspension(
            player: $this->makePlayer(),
            competitionType: 'league',
            competitionId: 1,
            reason: PlayerSuspension::REASON_RED_CARD,
            gamesSuspended: 1,
        );

        $this->assertTrue($suspension->isActive());

        $suspension->setIsActive(false);
        $this->assertFalse($suspension->isActive());

        $suspension->setIsActive(true);
        $this->assertTrue($suspension->isActive());
    }

    public function testCreatedAtIsSetOnConstruct(): void
    {
        $before = new DateTimeImmutable();

        $suspension = new PlayerSuspension(
            player: $this->makePlayer(),
            competitionType: 'league',
            competitionId: null,
            reason: PlayerSuspension::REASON_YELLOW_CARDS,
            gamesSuspended: 1,
        );

        $after = new DateTimeImmutable();

        $this->assertGreaterThanOrEqual($before, $suspension->getCreatedAt());
        $this->assertLessThanOrEqual($after, $suspension->getCreatedAt());
    }

    public function testReasonConstants(): void
    {
        $this->assertSame('yellow_cards', PlayerSuspension::REASON_YELLOW_CARDS);
        $this->assertSame('red_card', PlayerSuspension::REASON_RED_CARD);
        $this->assertSame('yellow_red_card', PlayerSuspension::REASON_YELLOW_RED_CARD);
    }
}
