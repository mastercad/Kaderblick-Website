<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Service\UserTeamAccessService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für UserTeamAccessService::getCoachLinkedTeams().
 *
 * Prüft: alle Relationstypen (nicht nur self_coach), aktive/inaktive
 * Assignments, Deduplication, kein Coach, kein Assignment.
 * Kein Datenbankzugriff — nur In-Memory-Entity-Iteration.
 */
#[AllowMockObjectsWithoutExpectations]
class UserTeamAccessServiceGetCoachLinkedTeamsTest extends TestCase
{
    private UserTeamAccessService $service;

    protected function setUp(): void
    {
        // EntityManager wird von getCoachLinkedTeams() nicht direkt verwendet
        // (nur in anderen Methoden). Mock wird aber für den Konstruktor benötigt.
        $em = $this->createMock(EntityManagerInterface::class);
        $this->service = new UserTeamAccessService($em);
    }

    // ── Hilfsfunktionen ────────────────────────────────────────────────────

    private function makeTeam(int $id): Team
    {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);

        return $team;
    }

    private function makeRelationType(string $identifier): RelationType
    {
        $rt = $this->createMock(RelationType::class);
        $rt->method('getIdentifier')->willReturn($identifier);

        return $rt;
    }

    private function makeCoachTeamAssignment(Team $team, ?DateTimeImmutable $start = null, ?DateTimeImmutable $end = null): CoachTeamAssignment
    {
        $cta = $this->createMock(CoachTeamAssignment::class);
        $cta->method('getTeam')->willReturn($team);
        $cta->method('getStartDate')->willReturn($start);
        $cta->method('getEndDate')->willReturn($end);

        return $cta;
    }

    /**
     * @param array<int, CoachTeamAssignment> $assignments
     */
    private function makeCoach(array $assignments): Coach
    {
        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection($assignments));

        return $coach;
    }

    private function makeRelation(RelationType $relationType, ?Coach $coach = null): UserRelation
    {
        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getCoach')->willReturn($coach);

        return $relation;
    }

    /**
     * @param array<int, UserRelation> $relations
     */
    private function makeUser(array $relations): User
    {
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection($relations));

        return $user;
    }

    // ── Tests ──────────────────────────────────────────────────────────────

    public function testReturnsEmptyWhenUserHasNoRelations(): void
    {
        $user = $this->makeUser([]);
        $result = $this->service->getCoachLinkedTeams($user);
        $this->assertSame([], $result);
    }

    public function testReturnsEmptyWhenRelationsHaveNoCoach(): void
    {
        $rt = $this->makeRelationType('fan');
        $relation = $this->makeRelation($rt, null);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);
        $this->assertSame([], $result);
    }

    public function testReturnsSingleTeamForActiveAssignment(): void
    {
        $team = $this->makeTeam(42);
        $cta = $this->makeCoachTeamAssignment($team); // kein Start/End → immer aktiv
        $coach = $this->makeCoach([$cta]);
        $rt = $this->makeRelationType('self_coach');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);

        $this->assertCount(1, $result);
        $this->assertArrayHasKey(42, $result);
        $this->assertSame($team, $result[42]);
    }

    public function testReturnsTeamForAnyRelationType(): void
    {
        // Nicht nur self_coach — auch assistant, observer etc. sollen Teams liefern
        $team = $this->makeTeam(7);
        $cta = $this->makeCoachTeamAssignment($team);
        $coach = $this->makeCoach([$cta]);
        $rt = $this->makeRelationType('assistant');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);

        $this->assertCount(1, $result);
        $this->assertSame($team, $result[7]);
    }

    public function testIgnoresExpiredAssignment(): void
    {
        $yesterday = new DateTimeImmutable('-1 day');

        $team = $this->makeTeam(10);
        $cta = $this->makeCoachTeamAssignment($team, null, $yesterday);
        $coach = $this->makeCoach([$cta]);
        $rt = $this->makeRelationType('self_coach');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);
        $this->assertSame([], $result);
    }

    public function testIgnoresFutureAssignment(): void
    {
        $tomorrow = new DateTimeImmutable('+1 day');

        $team = $this->makeTeam(11);
        $cta = $this->makeCoachTeamAssignment($team, $tomorrow, null);
        $coach = $this->makeCoach([$cta]);
        $rt = $this->makeRelationType('self_coach');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);
        $this->assertSame([], $result);
    }

    public function testDeduplicatesTeamsAcrossMultipleRelations(): void
    {
        // Zwei Relationen zeigen auf denselben Coach+Team
        $team = $this->makeTeam(99);
        $cta = $this->makeCoachTeamAssignment($team);
        $coach = $this->makeCoach([$cta]);

        $rt1 = $this->makeRelationType('self_coach');
        $rt2 = $this->makeRelationType('observer');
        $rel1 = $this->makeRelation($rt1, $coach);
        $rel2 = $this->makeRelation($rt2, $coach);
        $user = $this->makeUser([$rel1, $rel2]);

        $result = $this->service->getCoachLinkedTeams($user);

        $this->assertCount(1, $result);
        $this->assertArrayHasKey(99, $result);
    }

    public function testReturnsMultipleTeamsFromSingleCoach(): void
    {
        $team1 = $this->makeTeam(1);
        $team2 = $this->makeTeam(2);
        $cta1 = $this->makeCoachTeamAssignment($team1);
        $cta2 = $this->makeCoachTeamAssignment($team2);
        $coach = $this->makeCoach([$cta1, $cta2]);

        $rt = $this->makeRelationType('self_coach');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);

        $this->assertCount(2, $result);
        $this->assertArrayHasKey(1, $result);
        $this->assertArrayHasKey(2, $result);
    }

    public function testUsesCustomReferenceDate(): void
    {
        // Assignment ist nur in der Vergangenheit aktiv
        $past = new DateTimeImmutable('2020-01-01');
        $pastEnd = new DateTimeImmutable('2020-12-31');

        $team = $this->makeTeam(50);
        $cta = $this->makeCoachTeamAssignment($team, $past, $pastEnd);
        $coach = $this->makeCoach([$cta]);
        $rt = $this->makeRelationType('self_coach');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        // Mit einem Datum innerhalb des Zeitraums → aktiv
        $result = $this->service->getCoachLinkedTeams($user, new DateTimeImmutable('2020-06-15'));
        $this->assertCount(1, $result);

        // Mit einem Datum nach dem Zeitraum → nicht aktiv
        $result = $this->service->getCoachLinkedTeams($user, new DateTimeImmutable('2021-01-01'));
        $this->assertCount(0, $result);
    }

    public function testMixedActiveAndInactiveAssignments(): void
    {
        $teamActive = $this->makeTeam(100);
        $teamExpired = $this->makeTeam(200);

        $ctaActive = $this->makeCoachTeamAssignment($teamActive, null, new DateTimeImmutable('+1 year'));
        $ctaExpired = $this->makeCoachTeamAssignment($teamExpired, null, new DateTimeImmutable('-1 year'));

        $coach = $this->makeCoach([$ctaActive, $ctaExpired]);
        $rt = $this->makeRelationType('self_coach');
        $relation = $this->makeRelation($rt, $coach);
        $user = $this->makeUser([$relation]);

        $result = $this->service->getCoachLinkedTeams($user);

        $this->assertCount(1, $result);
        $this->assertArrayHasKey(100, $result);
        $this->assertArrayNotHasKey(200, $result);
    }
}
