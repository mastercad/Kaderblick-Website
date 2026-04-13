<?php

namespace App\Tests\Unit\Entity;

use App\Entity\Cup;
use App\Entity\Game;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

#[AllowMockObjectsWithoutExpectations]
class GameCupTest extends TestCase
{
    // -------------------------------------------------------------------------
    // cup defaults
    // -------------------------------------------------------------------------

    public function testCupDefaultsToNull(): void
    {
        $game = new Game();

        $this->assertNull($game->getCup());
    }

    // -------------------------------------------------------------------------
    // setCup / getCup
    // -------------------------------------------------------------------------

    public function testSetCup(): void
    {
        $game = new Game();
        $cup = $this->createMock(Cup::class);

        $game->setCup($cup);

        $this->assertSame($cup, $game->getCup());
    }

    public function testSetCupToNull(): void
    {
        $game = new Game();
        $cup = $this->createMock(Cup::class);

        $game->setCup($cup);
        $game->setCup(null);

        $this->assertNull($game->getCup());
    }

    public function testSetCupReturnsFluentSelf(): void
    {
        $game = new Game();
        $cup = $this->createMock(Cup::class);

        $this->assertSame($game, $game->setCup($cup));
    }

    public function testSetCupNullReturnsFluentSelf(): void
    {
        $game = new Game();

        $this->assertSame($game, $game->setCup(null));
    }

    // -------------------------------------------------------------------------
    // overwrite
    // -------------------------------------------------------------------------

    public function testSetCupOverwritesPreviousValue(): void
    {
        $game = new Game();
        $cup1 = $this->createMock(Cup::class);
        $cup2 = $this->createMock(Cup::class);

        $game->setCup($cup1);
        $game->setCup($cup2);

        $this->assertSame($cup2, $game->getCup());
        $this->assertNotSame($cup1, $game->getCup());
    }

    // -------------------------------------------------------------------------
    // cup and league are independent
    // -------------------------------------------------------------------------

    public function testCupAndLeagueAreIndependent(): void
    {
        $game = new Game();
        $cup = $this->createMock(Cup::class);
        $league = $this->createMock(\App\Entity\League::class);

        $game->setCup($cup);
        $game->setLeague($league);

        $this->assertSame($cup, $game->getCup());
        $this->assertSame($league, $game->getLeague());
    }
}
