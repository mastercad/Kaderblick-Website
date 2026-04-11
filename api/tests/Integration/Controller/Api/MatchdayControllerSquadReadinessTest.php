<?php

namespace Tests\Integration\Controller\Api;

use App\Entity\Player;
use App\Entity\Team;
use App\Entity\User;
use App\Service\UserTeamAccessService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Integration tests for UserTeamAccessService – squad readiness team visibility.
 *
 * Tests are named by dimension / ID from the test-matrix:
 *   Dimension A  – RelationsTyp          (12 tests)
 *   Dimension B  – Datumsbereich         (12 tests)
 *   Dimension C  – Team-Listen-Filter    ( 3 tests)
 *   Dimension D  – Mehrfachrelationen    ( 4 tests)
 *   Dimension E  – Methoden-Isolation    ( 2 tests)
 *                                       ─────────
 *                                         33 tests total
 *
 * Prerequisites: test fixtures loaded (bin/console doctrine:fixtures:load --group=master --group=test)
 *
 * Fixture references used:
 *   Users:  user_1..user_5, user_9..user_15, user_17..user_20, user_22..user_24
 *   Teams:  Team 1, Team 2, Team 3, Team 10
 *   Coaches: coach_1 (Team1, start 2023-01-01), coach_5 (Team2, start 2016-01-01),
 *            coach_6 (Team3, NULL dates), coach_8 (Team1, 2015..2020-12-31)
 */
class MatchdayControllerSquadReadinessTest extends KernelTestCase
{
    private UserTeamAccessService $service;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();
        $this->service = $container->get(UserTeamAccessService::class);
        $this->em = $container->get(EntityManagerInterface::class);
    }

    // ─────────────────────────────────────────────────────────── Helpers ───

    private function user(int $id): User
    {
        $user = $this->em->getRepository(User::class)
            ->findOneBy(['email' => 'user' . $id . '@example.com']);
        self::assertNotNull($user, 'Fixture user_' . $id . ' not found');

        return $user;
    }

    private function team(int $id): Team
    {
        $team = $this->em->getRepository(Team::class)->findOneBy(['name' => 'Team ' . $id]);
        self::assertNotNull($team, 'Fixture Team ' . $id . ' not found');

        return $team;
    }

    /** @return Team[] */
    private function teams(int ...$ids): array
    {
        return array_map([$this, 'team'], $ids);
    }

    /**
     * @param Team[] $teams
     *
     * @return int[]
     */
    private function teamIds(array $teams): array
    {
        return array_map(fn (Team $t) => $t->getId(), $teams);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DIMENSION A – RelationsTyp
    // ═══════════════════════════════════════════════════════════════════════

    /** A1 – self_player → ALLOW */
    public function testA1SelfPlayerGrantsAccess(): void
    {
        // user_9 → self_player → player_5_1 → Team 1 (PTA active, start 2023-01-01)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertCount(1, $result, 'self_player must grant player access');
    }

    /** A2 – parent → DENY (player access) */
    public function testA2ParentDeniesPlayerAccess(): void
    {
        // user_1 → parent → player_1_1 (Team 1)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(1),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'parent relation must not grant player access');
    }

    /** A3 – sibling → DENY (player access) */
    public function testA3SiblingDeniesPlayerAccess(): void
    {
        // user_2 → sibling → player_2_1 (Team 1)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(2),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'sibling relation must not grant player access');
    }

    /** A4 – relative → DENY (player access) */
    public function testA4RelativeDeniesPlayerAccess(): void
    {
        // user_17 → relative → player_10_1 (Team 1, new fixture)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(17),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'relative relation must not grant player access');
    }

    /** A5 – guardian → DENY (player access) */
    public function testA5GuardianDeniesPlayerAccess(): void
    {
        // user_18 → guardian → player_11_1 (Team 1, new fixture)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(18),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'guardian relation must not grant player access');
    }

    /** A6 – friend (player) → DENY (player access) */
    public function testA6FriendDeniesPlayerAccess(): void
    {
        // user_4 → friend → player_4_1 (Team 1)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(4),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'friend relation must not grant player access');
    }

    /** A7 – self_coach → ALLOW (coach access) */
    public function testA7SelfCoachGrantsCoachAccess(): void
    {
        // user_11 → self_coach → coach_1 → Team 1 (CTA active, start 2023-01-01)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(11),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertCount(1, $result, 'self_coach must grant coach access');
    }

    /** A8 – mentor → DENY (coach access) */
    public function testA8MentorDeniesCoachAccess(): void
    {
        // user_3 → mentor → coach_5 (Team 2)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(3),
            $this->teams(2),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'mentor relation must not grant coach access');
    }

    /** A9 – assistant → DENY (coach access) */
    public function testA9AssistantDeniesCoachAccess(): void
    {
        // user_19 → assistant → coach_1 (Team 1, new fixture)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(19),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'assistant relation must not grant coach access');
    }

    /** A10 – observer → DENY (coach access) */
    public function testA10ObserverDeniesCoachAccess(): void
    {
        // user_20 → observer → coach_5 (Team 2, new fixture)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(20),
            $this->teams(2),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'observer relation must not grant coach access');
    }

    /** A11 – substitute → DENY (coach access) */
    public function testA11SubstituteDeniesCoachAccess(): void
    {
        // user_22 → substitute → coach_1 (Team 1, new fixture)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(22),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'substitute relation must not grant coach access');
    }

    /** A12 – friend (coach) → DENY (coach access) */
    public function testA12FriendDeniesCoachAccess(): void
    {
        // user_5 → friend → coach_3 (Team 10, CTA start 2023-01-01)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(5),
            $this->teams(10),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'friend relation must not grant coach access');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DIMENSION B – Datumsbereich
    // ═══════════════════════════════════════════════════════════════════════

    /** B1 – Coach aktiv, eventDate im aktiven Zeitraum → ALLOW */
    public function testB1CoachActiveOnDate(): void
    {
        // user_11 → coach_1 (start 2023-01-01, no end)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(11),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertCount(1, $result);
    }

    /** B2 – Coach noch nicht gestartet, eventDate vor Start → DENY */
    public function testB2CoachNotYetStarted(): void
    {
        // user_11 → coach_1 (start 2023-01-01), test date 2022-01-01
        $result = $this->service->getCoachTeamsForDate(
            $this->user(11),
            $this->teams(1),
            new DateTimeImmutable('2022-01-01'),
        );
        self::assertEmpty($result, 'CTA not yet started on event date');
    }

    /** B3 – Coach abgelaufen, eventDate nach Ablauf → DENY */
    public function testB3CoachAssignmentExpired(): void
    {
        // user_13 → coach_8 (Team1, end 2020-12-31)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(13),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'expired CTA must not grant access');
    }

    /** B4 – Coach Grenzwert: eventDate == startDate → ALLOW (inclusive) */
    public function testB4CoachBoundaryStartDate(): void
    {
        // user_11 → coach_1 (start exactly 2023-01-01)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(11),
            $this->teams(1),
            new DateTimeImmutable('2023-01-01'),
        );
        self::assertCount(1, $result, 'start date itself must grant access (>=)');
    }

    /** B5 – Coach Grenzwert: eventDate == endDate → ALLOW (inclusive) */
    public function testB5CoachBoundaryEndDate(): void
    {
        // user_13 → coach_8 (Team1, end exactly 2020-12-31)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(13),
            $this->teams(1),
            new DateTimeImmutable('2020-12-31'),
        );
        self::assertCount(1, $result, 'end date itself must grant access (endDate >= referenceDate)');
    }

    /** B6 – Coach startDate=NULL + endDate=NULL → immer aktiv → ALLOW */
    public function testB6CoachNullDatesAlwaysActive(): void
    {
        // user_23 → self_coach → coach_6 → Team 3 (CTA: null start, null end)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(23),
            $this->teams(3),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertCount(1, $result, 'null start/end dates mean always active');
    }

    /** B7 – Coach eventDate=null → Fallback auf heute → ALLOW (assuming fixture is still active) */
    public function testB7CoachNullEventDateFallsBackToToday(): void
    {
        // user_11 → coach_1 (no end date → still active today)
        $result = $this->service->getCoachTeamsForDate(
            $this->user(11),
            $this->teams(1),
            null,
        );
        self::assertCount(1, $result, 'null referenceDate must fall back to today');
    }

    /** B8 – Player aktiv, eventDate im Zeitraum → ALLOW */
    public function testB8PlayerActiveOnDate(): void
    {
        // user_9 → player_5_1 (start 2023-01-01, no end)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertCount(1, $result);
    }

    /** B9 – Player noch nicht gestartet, eventDate vor Start → DENY */
    public function testB9PlayerNotYetStarted(): void
    {
        // user_9 → player_5_1 (start 2023-01-01), test date 2022-01-01
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            $this->teams(1),
            new DateTimeImmutable('2022-01-01'),
        );
        self::assertEmpty($result, 'PTA not yet started on event date');
    }

    /** B10 – Player Grenzwert: eventDate == startDate → ALLOW (inclusive) */
    public function testB10PlayerBoundaryStartDate(): void
    {
        // user_9 → player_5_1 (PTA start exactly 2023-01-01)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            $this->teams(1),
            new DateTimeImmutable('2023-01-01'),
        );
        self::assertCount(1, $result, 'start date itself must grant access');
    }

    /** B11 – Player eventDate=null → Fallback auf heute → ALLOW */
    public function testB11PlayerNullEventDateFallsBackToToday(): void
    {
        // user_9 → player_5_1 (no end date → still active today)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            $this->teams(1),
            null,
        );
        self::assertCount(1, $result, 'null referenceDate must fall back to today');
    }

    /** B12 – Player abgelaufene PTA → DENY */
    public function testB12PlayerExpiredPtaDeniesAccess(): void
    {
        // user_24 → self_player → ExpiredTest player (PTA end 2021-12-31)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(24),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'expired PTA must not grant access');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DIMENSION C – Team-Listen-Filter
    // ═══════════════════════════════════════════════════════════════════════

    /** C1 – Das Team des Users ist in der Kandidatenliste → ALLOW */
    public function testC1TeamInCandidateList(): void
    {
        $result = $this->service->getCoachTeamsForDate(
            $this->user(11),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertCount(1, $result);
    }

    /** C2 – Das Team des Users ist NICHT in der Kandidatenliste → [] */
    public function testC2UserTeamNotInCandidateList(): void
    {
        // user_9 is player in Team 1, but candidate list only contains Team 2
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            $this->teams(2),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'user team not in candidate list must return []');
    }

    /** C3 – Kandidatenliste leer → [] */
    public function testC3EmptyCandidateListReturnsEmpty(): void
    {
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(9),
            [],
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DIMENSION D – Mehrfachrelationen
    // ═══════════════════════════════════════════════════════════════════════

    /** D1 – user_12 dual (self_player→T1 + self_coach→T2) → Player-Methode: [T1] only */
    public function testD1DualRolePlayerMethodReturnsOnlyPlayerTeam(): void
    {
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(12),
            $this->teams(1, 2),
            new DateTimeImmutable('2024-06-15'),
        );
        $ids = $this->teamIds($result);
        self::assertContains($this->team(1)->getId(), $ids, 'must include Team 1 (self_player)');
        self::assertNotContains($this->team(2)->getId(), $ids, 'must not include Team 2 via player method');
    }

    /** D2 – user_12 dual (self_player→T1 + self_coach→T2) → Coach-Methode: [T2] only */
    public function testD2DualRoleCoachMethodReturnsOnlyCoachTeam(): void
    {
        $result = $this->service->getCoachTeamsForDate(
            $this->user(12),
            $this->teams(1, 2),
            new DateTimeImmutable('2024-06-15'),
        );
        $ids = $this->teamIds($result);
        self::assertNotContains($this->team(1)->getId(), $ids, 'must not include Team 1 via coach method');
        self::assertContains($this->team(2)->getId(), $ids, 'must include Team 2 (self_coach)');
    }

    /** D3 – user_15 zwei self_player (T1 + T2) → beide Teams */
    public function testD3TwoSelfPlayerRelationsReturnBothTeams(): void
    {
        // user_15 → self_player → player_7_1 (Team 1) + player_7_2 (Team 2)
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(15),
            $this->teams(1, 2),
            new DateTimeImmutable('2024-06-15'),
        );
        $ids = $this->teamIds($result);
        self::assertContains($this->team(1)->getId(), $ids, 'must include Team 1');
        self::assertContains($this->team(2)->getId(), $ids, 'must include Team 2');
    }

    /** D4 – user_10, keine Relation → [] für beide Methoden */
    public function testD4NoRelationReturnsEmpty(): void
    {
        $user = $this->user(10);
        $date = new DateTimeImmutable('2024-06-15');
        self::assertEmpty(
            $this->service->getPlayerTeamsForDate($user, $this->teams(1), $date),
            'player method must return [] for user without relations',
        );
        self::assertEmpty(
            $this->service->getCoachTeamsForDate($user, $this->teams(1), $date),
            'coach method must return [] for user without relations',
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DIMENSION E – Methoden-Isolation
    // ═══════════════════════════════════════════════════════════════════════

    /** E1 – self_player-User → getCoachTeamsForDate gibt [] zurück */
    public function testE1SelfPlayerUserInCoachMethodReturnsEmpty(): void
    {
        // user_9 only has self_player relation
        $result = $this->service->getCoachTeamsForDate(
            $this->user(9),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'self_player user must not appear in coach method');
    }

    /** E2 – self_coach-User → getPlayerTeamsForDate gibt [] zurück */
    public function testE2SelfCoachUserInPlayerMethodReturnsEmpty(): void
    {
        // user_11 only has self_coach relation
        $result = $this->service->getPlayerTeamsForDate(
            $this->user(11),
            $this->teams(1),
            new DateTimeImmutable('2024-06-15'),
        );
        self::assertEmpty($result, 'self_coach user must not appear in player method');
    }
}
