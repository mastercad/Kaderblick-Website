<?php

namespace App\Tests\Unit\Repository;

use App\Entity\Formation;
use App\Entity\Team;
use App\Repository\FormationRepository;
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
 * Prüft die QueryBuilder-Logik für findVisibleForUser() und findByTeam()
 * ohne echte Datenbankverbindung.
 */
#[AllowMockObjectsWithoutExpectations]
class FormationRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private QueryBuilder&MockObject $qb;
    private Query&MockObject $query;
    private FormationRepository $repository;

    /** Zuletzt übergebene Teams aus setParameter(':teams', ...) */
    private mixed $capturedTeamsParam = null;

    /** Alle setParameter-Aufrufe */
    private array $capturedParams = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->qb = $this->createMock(QueryBuilder::class);
        $this->query = $this->createMock(Query::class);

        $this->qb
            ->method('setParameter')
            ->willReturnCallback(function (string $key, mixed $value) {
                if ('teams' === $key) {
                    $this->capturedTeamsParam = $value;
                }
                $this->capturedParams[$key] = $value;

                return $this->qb;
            });

        // Alle fluenten QB-Methoden zurückgeben sich selbst
        foreach (['select', 'from', 'where', 'andWhere', 'orderBy'] as $method) {
            $this->qb->method($method)->willReturnSelf();
        }

        $this->qb
            ->method('getQuery')
            ->willReturn($this->query);

        $this->em
            ->method('createQueryBuilder')
            ->willReturn($this->qb);

        $meta = $this->createMock(ClassMetadata::class);
        $meta->name = Formation::class;
        $this->em->method('getClassMetadata')->willReturn($meta);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);
        $registry->method('getManager')->willReturn($this->em);

        $this->repository = new FormationRepository($registry);
    }

    // ─── findVisibleForUser ────────────────────────────────────────────────────

    public function testReturnsEmptyArrayWhenCoachTeamsIsEmpty(): void
    {
        $result = $this->repository->findVisibleForUser([]);

        $this->assertSame([], $result);
    }

    public function testPassesTeamsToQueryBuilder(): void
    {
        $team1 = $this->createMock(Team::class);
        $team2 = $this->createMock(Team::class);

        $formation = $this->createMock(Formation::class);
        $this->query->method('getResult')->willReturn([$formation]);

        $this->repository->findVisibleForUser([1 => $team1, 2 => $team2]);

        $this->assertSame([1 => $team1, 2 => $team2], $this->capturedTeamsParam);
    }

    public function testReturnsQueryResult(): void
    {
        $team = $this->createMock(Team::class);
        $formation = $this->createMock(Formation::class);

        $this->query->method('getResult')->willReturn([$formation]);

        $result = $this->repository->findVisibleForUser([10 => $team]);

        $this->assertSame([$formation], $result);
    }

    public function testReturnsEmptyArrayWhenQueryReturnsNothing(): void
    {
        $team = $this->createMock(Team::class);

        $this->query->method('getResult')->willReturn([]);

        $result = $this->repository->findVisibleForUser([10 => $team]);

        $this->assertSame([], $result);
    }

    // ─── findByTeam ───────────────────────────────────────────────────────────

    public function testFindByTeamNeverCallsSetParametersWithArray(): void
    {
        $this->qb->expects($this->never())->method('setParameters');

        $this->repository->findByTeam(42);
    }

    public function testFindByTeamSetsTeamIdParameter(): void
    {
        $this->query->method('getResult')->willReturn([]);

        $this->repository->findByTeam(42);

        $this->assertArrayHasKey('teamId', $this->capturedParams);
        $this->assertSame(42, $this->capturedParams['teamId']);
    }

    public function testFindByTeamReturnsQueryResult(): void
    {
        $formation = $this->createMock(Formation::class);
        $this->query->method('getResult')->willReturn([$formation]);

        $result = $this->repository->findByTeam(1);

        $this->assertCount(1, $result);
        $this->assertSame($formation, $result[0]);
    }

    public function testFindByTeamReturnsEmptyArrayWhenNoFormationsFound(): void
    {
        $this->query->method('getResult')->willReturn([]);

        $result = $this->repository->findByTeam(99);

        $this->assertSame([], $result);
    }
}
