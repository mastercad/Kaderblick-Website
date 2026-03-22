<?php

namespace App\Tests\Unit\Service;

use App\Entity\PlayerTitle;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\PlayerTitleRepository;
use App\Service\TitleCalculationService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

// Dummy-Klassen für die benötigten Methoden (nach namespace, vor Testklasse)
// @phpcs:disable Generic.Files.OneClassPerFile
class DummyRelationType
{
    public function getIdentifier(): string
    {
        return 'self_player';
    }
}

// @phpcs:disable Generic.Files.OneClassPerFile
class DummyUserRelation
{
    private User $user;

    public function __construct(User $user)
    {
        $this->user = $user;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getRelationType(): DummyRelationType
    {
        return new DummyRelationType();
    }
}

// @phpcs:disable Generic.Files.OneClassPerFile
class DummyPlayer
{
    private DummyUserRelation $userRelation;

    public function __construct(DummyUserRelation $userRelation)
    {
        $this->userRelation = $userRelation;
    }

    /**
     * @return DummyUserRelation[]
     */
    public function getUserRelations(): array
    {
        return [$this->userRelation];
    }

    public function getId(): int
    {
        return 1;
    }
}

#[AllowMockObjectsWithoutExpectations]
class TitleCalculationServiceTest extends TestCase
{
    public function testAwardTitlesOlympicPrinciple(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $repo->method('findOneBy')->willReturn(null);
        $repo->method('deactivateTitles');

        $service = new TitleCalculationService($em, $repo);

        $player1 = new \App\Entity\Player();
        $reflection1 = new ReflectionClass($player1);
        $idProp1 = $reflection1->getProperty('id');
        $idProp1->setAccessible(true);
        $idProp1->setValue($player1, 1);

        $player2 = new \App\Entity\Player();
        $reflection2 = new ReflectionClass($player2);
        $idProp2 = $reflection2->getProperty('id');
        $idProp2->setAccessible(true);
        $idProp2->setValue($player2, 2);

        $player3 = new \App\Entity\Player();
        $reflection3 = new ReflectionClass($player3);
        $idProp3 = $reflection3->getProperty('id');
        $idProp3->setAccessible(true);
        $idProp3->setValue($player3, 3);

        $playerGoals = [
            ['player' => $player1, 'goal_count' => 10],
            ['player' => $player2, 'goal_count' => 10],
            ['player' => $player3, 'goal_count' => 8],
        ];

        $result = $this->invokeAwardTitlesPerPlayerFromArray($service, $playerGoals, 'top_scorer', 'platform', null, '2025/2026', true);
        $this->assertCount(3, $result, 'Alle drei Spieler sollten einen Titel erhalten.');
        $ranks = array_map(fn ($t) => $t->getTitleRank(), $result);
        $this->assertEqualsCanonicalizing(['bronze', 'gold', 'gold'], $ranks, 'Zwei Gold, dann Bronze (Silber entfällt, Logik wie im Service).');
    }

    public function testAwardTitleDoesNotCreateDuplicates(): void
    {
        $user = $this->createMock(User::class);
        $team = $this->createMock(Team::class);
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);

        // Repository gibt bereits existierenden Titel zurück
        $repo->method('findOneBy')->willReturn(new PlayerTitle());
        $repo->method('deactivateTitles');
        $em->method('getRepository')->willReturn($repo);

        $service = new TitleCalculationService($em, $repo);

        $userRelationMock = new DummyUserRelation($user);
        $playerMock = new DummyPlayer($userRelationMock);

        $playerGoals = [
            [
                'player' => $playerMock,
                'goal_count' => 5
            ]
        ];

        $result = $this->invokeAwardTitlesPerPlayerFromArray($service, $playerGoals, 'top_scorer', 'platform', null, '2025/2026', false);
        $this->assertCount(1, $result, 'Es sollte nur ein Titel vergeben werden, auch bei erneutem Aufruf.');
    }

    /**
     * @param array<int, array<string, mixed>> $playerGoals
     *
     * @return PlayerTitle[]
     */
    private function invokeAwardTitlesPerPlayerFromArray(TitleCalculationService $service, array $playerGoals, string $cat, string $scope, ?Team $team, ?string $season, bool $useOlympicRanking = false): array
    {
        $ref = new ReflectionClass($service);
        $method = $ref->getMethod('awardTitlesPerPlayerFromArray');
        $method->setAccessible(true);

        // Pass explicit null for $league to ensure the $useOlympicRanking
        // parameter is bound correctly as the last argument.
        return $method->invoke($service, $playerGoals, $cat, $scope, $team, $season, null, $useOlympicRanking);
    }

    public function testThreePlayersSameGoalsReceiveSameRank(): void
    {
        $repo = $this->createMock(PlayerTitleRepository::class);
        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('getRepository')->willReturn($repo);
        $repo->method('findOneBy')->willReturn(null);
        $repo->method('deactivateTitles');

        $service = new TitleCalculationService($em, $repo);

        $player1 = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player1->method('getId')->willReturn(1);
        $player1->method('getLastName')->willReturn('A');
        $player2 = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player2->method('getId')->willReturn(2);
        $player2->method('getLastName')->willReturn('B');
        $player3 = $this->getMockBuilder(\App\Entity\Player::class)->onlyMethods(['getId', 'getLastName'])->getMock();
        $player3->method('getId')->willReturn(3);
        $player3->method('getLastName')->willReturn('C');

        $playerGoals = [
            ['player' => $player1, 'goal_count' => 5],
            ['player' => $player2, 'goal_count' => 5],
            ['player' => $player3, 'goal_count' => 5],
        ];

        $result = $this->invokeAwardTitlesPerPlayerFromArray($service, $playerGoals, 'top_scorer', 'platform', null, '2025/2026');
        $this->assertCount(3, $result, 'Alle drei Spieler sollten einen Titel erhalten.');
        $ranks = array_map(fn ($t) => $t->getTitleRank(), $result);
        $this->assertEqualsCanonicalizing(['gold', 'gold', 'gold'], $ranks, 'Drei Spieler mit gleicher Toranzahl sollten alle Gold erhalten.');
    }
}
