<?php

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

class GamesControllerMatchPlanTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private Team $homeTeam;
    private Team $awayTeam;
    private Team $externalTeam;
    private Game $game;
    private CalendarEvent $calendarEvent;

    private RelationType $selfPlayerType;
    private RelationType $selfCoachType;

    private User $homePlayerUser;
    private User $externalPlayerUser;
    private User $homeCoachUser;
    private int $homePlayerId;
    private string $emailSuffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        self::assertNotNull($position, 'Keine Fixture-Position. Bitte Fixtures laden.');

        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Kein Fixture-GameType. Bitte Fixtures laden.');

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        $this->selfPlayerType = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => 'self_player']);
        self::assertNotNull($this->selfPlayerType, 'RelationType "self_player" nicht gefunden. Bitte Fixtures laden.');

        $this->selfCoachType = $this->em->getRepository(RelationType::class)->findOneBy(['identifier' => 'self_coach']);
        self::assertNotNull($this->selfCoachType, 'RelationType "self_coach" nicht gefunden. Bitte Fixtures laden.');
        $this->emailSuffix = bin2hex(random_bytes(6));

        $this->homeTeam = (new Team())
            ->setName('test-match-plan-home')
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = (new Team())
            ->setName('test-match-plan-away')
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        $this->externalTeam = (new Team())
            ->setName('test-match-plan-external')
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->externalTeam);

        $this->calendarEvent = (new CalendarEvent())
            ->setTitle('test-match-plan-event')
            ->setStartDate(new DateTime())
            ->setEndDate(new DateTime('+2 hours'));
        $this->em->persist($this->calendarEvent);

        $this->game = (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam)
            ->setGameType($gameType)
            ->setCalendarEvent($this->calendarEvent)
            ->setMatchPlan([
                'selectedTeamId' => null,
                'published' => true,
                'publishedAt' => '2026-04-02T12:00:00+00:00',
                'phases' => [
                    [
                        'id' => 'start',
                        'minute' => 0,
                        'label' => 'Start',
                        'sourceType' => 'start',
                        'players' => [],
                        'bench' => [],
                    ],
                ],
            ]);
        $this->em->persist($this->game);

        $this->homePlayerUser = $this->createPlayerUser(
            $this->uniqueEmail('test-match-plan-home-player'),
            'MatchPlan',
            'Heimspieler',
            $this->homeTeam,
            $position,
            6
        );

        $this->externalPlayerUser = $this->createPlayerUser(
            $this->uniqueEmail('test-match-plan-external-player'),
            'MatchPlan',
            'Fremdspieler',
            $this->externalTeam,
            $position,
            16
        );

        $this->homeCoachUser = $this->createCoachUser(
            $this->uniqueEmail('test-match-plan-coach'),
            'MatchPlan',
            'Trainer',
            $this->homeTeam
        );

        $this->em->flush();
        $this->homePlayerId = $this->resolveLinkedPlayer($this->homePlayerUser)->getId();

        $this->game->setMatchPlan([
            'selectedTeamId' => $this->homeTeam->getId(),
            'published' => true,
            'publishedAt' => '2026-04-02T12:00:00+00:00',
            'phases' => [
                [
                    'id' => 'start',
                    'minute' => 0,
                    'label' => 'Start',
                    'sourceType' => 'start',
                    'players' => [
                        [
                            'id' => 1,
                            'x' => 50,
                            'y' => 90,
                            'number' => 6,
                            'name' => 'MatchPlan Heimspieler',
                            'playerId' => $this->homePlayerId,
                            'isRealPlayer' => true,
                        ],
                    ],
                    'bench' => [],
                ],
            ],
        ]);
        $this->em->flush();
    }

    public function testDetailsExposePublishedMatchPlanForPlayerOfSelectedTeam(): void
    {
        $this->authenticate($this->homePlayerUser);

        $data = $this->requestDetails();

        self::assertArrayHasKey('game', $data);
        self::assertSame($this->homeTeam->getId(), $data['game']['matchPlan']['selectedTeamId']);
        self::assertTrue($data['game']['permissions']['can_view_match_plan']);
        self::assertContains($this->homeTeam->getId(), $data['game']['userTeamIds']);
    }

    public function testDetailsHidePublishedMatchPlanForPlayerOfDifferentTeam(): void
    {
        $this->authenticate($this->externalPlayerUser);

        $data = $this->requestDetails();

        self::assertArrayHasKey('game', $data);
        self::assertNull($data['game']['matchPlan']);
        self::assertFalse($data['game']['permissions']['can_view_match_plan']);
        self::assertContains($this->externalTeam->getId(), $data['game']['userTeamIds']);
    }

    public function testCoachOfParticipatingTeamCanSaveMatchPlan(): void
    {
        $this->authenticate($this->homeCoachUser);

        $payload = [
            'selectedTeamId' => $this->homeTeam->getId(),
            'published' => false,
            'phases' => [
                [
                    'id' => 'start',
                    'minute' => 0,
                    'label' => 'Start',
                    'sourceType' => 'start',
                    'players' => [],
                    'bench' => [],
                ],
                [
                    'id' => 'phase-1',
                    'minute' => 1800,
                    'label' => '30. Minute',
                    'sourceType' => 'shape_change',
                    'players' => [],
                    'bench' => [],
                ],
            ],
        ];

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/match-plan',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode($payload, JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($data['success']);
        self::assertSame('30. Minute', $data['matchPlan']['phases'][1]['label']);

        $this->em->refresh($this->game);
        self::assertSame('30. Minute', $this->game->getMatchPlan()['phases'][1]['label']);
    }

    public function testPlayerCannotSaveMatchPlan(): void
    {
        $this->authenticate($this->homePlayerUser);

        $this->client->request(
            'PATCH',
            '/api/games/' . $this->game->getId() . '/match-plan',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode([
                'selectedTeamId' => $this->homeTeam->getId(),
                'published' => true,
                'phases' => [],
            ], JSON_THROW_ON_ERROR)
        );

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    /** @return array<string, mixed> */
    private function requestDetails(): array
    {
        $this->client->request('GET', '/api/games/' . $this->game->getId() . '/details');
        self::assertResponseIsSuccessful();

        return json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
    }

    private function createPlayerUser(
        string $email,
        string $firstName,
        string $lastName,
        Team $team,
        Position $position,
        int $shirtNumber
    ): User {
        $player = (new Player())
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setMainPosition($position);
        $this->em->persist($player);

        $assignment = new PlayerTeamAssignment();
        $assignment->setPlayer($player);
        $assignment->setTeam($team);
        $assignment->setShirtNumber($shirtNumber);
        $assignment->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($assignment);
        $player->addPlayerTeamAssignment($assignment);
        $team->addPlayerTeamAssignment($assignment);

        $user = (new User())
            ->setEmail($email)
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setPassword('test')
            ->setRoles(['ROLE_USER'])
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);

        $relation = (new UserRelation())
            ->setUser($user)
            ->setPlayer($player)
            ->setRelationType($this->selfPlayerType)
            ->setPermissions([]);
        $this->em->persist($relation);
        $user->addUserRelation($relation);
        $player->addUserRelation($relation);

        return $user;
    }

    private function createCoachUser(string $email, string $firstName, string $lastName, Team $team): User
    {
        $coach = (new Coach())
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setEmail($email);
        $this->em->persist($coach);

        $assignment = new CoachTeamAssignment();
        $assignment->setCoach($coach);
        $assignment->setTeam($team);
        $assignment->setStartDate(new DateTime('2020-01-01'));
        $this->em->persist($assignment);
        $coach->addCoachTeamAssignment($assignment);
        $team->addCoachTeamAssignment($assignment);

        $user = (new User())
            ->setEmail($email)
            ->setFirstName($firstName)
            ->setLastName($lastName)
            ->setPassword('test')
            ->setRoles(['ROLE_USER'])
            ->setIsEnabled(true)
            ->setIsVerified(true);
        $this->em->persist($user);

        $relation = (new UserRelation())
            ->setUser($user)
            ->setCoach($coach)
            ->setRelationType($this->selfCoachType)
            ->setPermissions([]);
        $this->em->persist($relation);
        $user->addUserRelation($relation);
        $coach->addUserRelation($relation);

        return $user;
    }

    private function resolveLinkedPlayer(User $user): Player
    {
        foreach ($user->getUserRelations() as $relation) {
            if (null !== $relation->getPlayer()) {
                return $relation->getPlayer();
            }
        }

        self::fail('Dem User ist kein Spieler zugeordnet.');
    }

    private function uniqueEmail(string $prefix): string
    {
        return sprintf('%s-%s@example.com', $prefix, $this->emailSuffix);
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }
}
