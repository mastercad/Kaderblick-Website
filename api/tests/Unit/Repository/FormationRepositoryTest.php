<?php

namespace App\Tests\Unit\Repository;

use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Formation;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\FormationRepository;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für FormationRepository.
 *
 * Prüft die QueryBuilder-Logik für findVisibleFormationsForUser() und findByTeam()
 * ohne echte Datenbankverbindung.
 */
#[AllowMockObjectsWithoutExpectations]
class FormationRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    /** @var Formation[] */
    private array $queryResult = [];
    private FormationRepository $repository;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        foreach (['select', 'from', 'distinct', 'join', 'leftJoin', 'where', 'andWhere', 'orWhere', 'setParameter', 'orderBy', 'addOrderBy'] as $method) {
            $this->qb->method($method)->willReturnSelf();
        }
        $this->qb->method('getQuery')->willReturn($this->query);
        $this->query->method('getResult')->willReturnCallback(fn () => $this->queryResult);

        $this->em->method('createQueryBuilder')->willReturn($this->qb);

        $metadata = $this->createMock(ClassMetadata::class);
        $metadata->name = Formation::class;
        $this->em->method('getClassMetadata')->willReturn($metadata);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new FormationRepository($registry);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private function makeRelationType(string $identifier): RelationType&MockObject
    {
        $rt = $this->createMock(RelationType::class);
        $rt->method('getIdentifier')->willReturn($identifier);

        return $rt;
    }

    /** Baut einen User mit einer self_coach-Relation zu einem Team. */
    private function makeCoachUser(
        ?DateTimeImmutable $startDate = null,
        ?DateTimeImmutable $endDate = null,
    ): User&MockObject {
        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn(7);

        $cta = $this->createMock(CoachTeamAssignment::class);
        $cta->method('getTeam')->willReturn($team);
        $cta->method('getStartDate')->willReturn($startDate);
        $cta->method('getEndDate')->willReturn($endDate);

        $coach = $this->createMock(Coach::class);
        $coach->method('getCoachTeamAssignments')->willReturn(new ArrayCollection([$cta]));

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($this->makeRelationType('self_coach'));
        $relation->method('getCoach')->willReturn($coach);
        $relation->method('getPlayer')->willReturn(null);

        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection([$relation]));

        return $user;
    }

    // ─── findVisibleFormationsForUser ─────────────────────────────────────────

    public function testFindVisibleFormationsForUserReturnsEmptyArrayWhenUserHasNoTeams(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection());

        // Auch ohne Teams wird die DB abgefragt — eigene Formationen werden immer gesucht
        $result = $this->repository->findVisibleFormationsForUser($user);
        $this->assertSame([], $result);
    }

    public function testFindVisibleFormationsForUserAlwaysSetsCurrentUserParameter(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getUserRelations')->willReturn(new ArrayCollection());

        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findVisibleFormationsForUser($user);

        $this->assertArrayHasKey('currentUser', $setCalls);
        $this->assertSame($user, $setCalls['currentUser']);
    }

    public function testFindVisibleFormationsForUserNeverCallsSetParametersWithArray(): void
    {
        $this->qb->expects($this->never())->method('setParameters');

        $user = $this->makeCoachUser();
        $this->repository->findVisibleFormationsForUser($user);
    }

    public function testFindVisibleFormationsForUserSetsSelfCoachParameter(): void
    {
        $user = $this->makeCoachUser();

        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findVisibleFormationsForUser($user);

        $this->assertArrayHasKey('selfCoach', $setCalls);
        $this->assertSame('self_coach', $setCalls['selfCoach']);
    }

    public function testFindVisibleFormationsForUserSetsTeamIdsParameter(): void
    {
        $user = $this->makeCoachUser();

        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findVisibleFormationsForUser($user);

        $this->assertArrayHasKey('teamIds', $setCalls);
        $this->assertContains(7, $setCalls['teamIds']);
    }

    public function testFindVisibleFormationsForUserSetsTodayParameter(): void
    {
        $user = $this->makeCoachUser();
        $before = new DateTimeImmutable();

        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findVisibleFormationsForUser($user);
        $after = new DateTimeImmutable();

        $this->assertArrayHasKey('today', $setCalls);
        $this->assertGreaterThanOrEqual($before, $setCalls['today']);
        $this->assertLessThanOrEqual($after, $setCalls['today']);
    }

    public function testFindVisibleFormationsForUserReturnsQueryResult(): void
    {
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $user = $this->makeCoachUser();
        $result = $this->repository->findVisibleFormationsForUser($user);

        $this->assertCount(1, $result);
        $this->assertSame($formation, $result[0]);
    }

    public function testFindVisibleFormationsForUserIgnoresExpiredCoachAssignment(): void
    {
        // Abgelaufene Trainer-Zuordnung → teamIds ist leer → teamId/selfCoach-Parameter werden nicht gesetzt
        $pastEnd = new DateTimeImmutable('yesterday');
        $user = $this->makeCoachUser(null, $pastEnd);

        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findVisibleFormationsForUser($user);

        $this->assertArrayHasKey('currentUser', $setCalls);
        $this->assertArrayNotHasKey('teamIds', $setCalls);
        $this->assertArrayNotHasKey('selfCoach', $setCalls);
    }

    // ─── findByTeam ───────────────────────────────────────────────────────────

    public function testFindByTeamNeverCallsSetParametersWithArray(): void
    {
        $this->qb->expects($this->never())->method('setParameters');

        $this->repository->findByTeam(42);
    }

    public function testFindByTeamSetsSelfCoachParameter(): void
    {
        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findByTeam(42);

        $this->assertArrayHasKey('selfCoach', $setCalls);
        $this->assertSame('self_coach', $setCalls['selfCoach']);
    }

    public function testFindByTeamSetsTeamIdParameter(): void
    {
        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findByTeam(42);

        $this->assertArrayHasKey('teamId', $setCalls);
        $this->assertSame(42, $setCalls['teamId']);
    }

    public function testFindByTeamSetsTodayParameter(): void
    {
        $before = new DateTimeImmutable();

        $setCalls = [];
        $this->qb->expects($this->atLeastOnce())
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) use (&$setCalls) {
                $setCalls[$key] = $value;

                return $this->qb;
            });

        $this->repository->findByTeam(42);
        $after = new DateTimeImmutable();

        $this->assertArrayHasKey('today', $setCalls);
        $this->assertGreaterThanOrEqual($before, $setCalls['today']);
        $this->assertLessThanOrEqual($after, $setCalls['today']);
    }

    public function testFindByTeamReturnsQueryResult(): void
    {
        $formation = $this->createMock(Formation::class);
        $this->queryResult = [$formation];

        $result = $this->repository->findByTeam(1);

        $this->assertCount(1, $result);
        $this->assertSame($formation, $result[0]);
    }

    public function testFindByTeamReturnsEmptyArrayWhenNoFormationsFound(): void
    {
        $this->queryResult = [];
        $result = $this->repository->findByTeam(99);
        $this->assertSame([], $result);
    }
}
