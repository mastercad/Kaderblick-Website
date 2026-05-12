<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Coach;
use App\Entity\CoachTeamAssignment;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\GameType;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature-Tests für GameEventsController::addEvent().
 *
 * Abgedeckt:
 * - Authentifizierungspflicht
 * - Spieler-Ereignisse (eventId im Response, success=true, DB-Persistenz, Team-Auflösung)
 * - Coach-Ereignisse (z.B. gelbe Karte für Trainer, Team-Auflösung aus Coaching-Zuordnung)
 * - Ungültige Anfragen geben 400 zurück
 *
 * Alle Tests laufen in einer DB-Transaktion, die am Ende zurückgerollt wird.
 */
class GameEventsControllerEventIdTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private Game $game;
    private Team $homeTeam;
    private Team $awayTeam;
    private Coach $homeCoach;
    private Player $homePlayer;
    private User $superAdminUser;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $suffix = bin2hex(random_bytes(6));

        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        self::assertNotNull($gameType, 'Kein Fixture-GameType. Bitte Fixtures laden.');

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        $spielType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        self::assertNotNull($spielType, 'CalendarEventType "Spiel" nicht gefunden. Bitte Fixtures laden.');

        $this->homeTeam = (new Team())
            ->setName('test-gevid-home-' . $suffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->homeTeam);

        $this->awayTeam = (new Team())
            ->setName('test-gevid-away-' . $suffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->awayTeam);

        $calendarEvent = (new CalendarEvent())
            ->setTitle('test-gevid-' . $suffix)
            ->setStartDate(new DateTime('-1 hour'))
            ->setEndDate(new DateTime('+1 hour'))
            ->setCalendarEventType($spielType);
        $this->em->persist($calendarEvent);

        $this->game = (new Game())
            ->setHomeTeam($this->homeTeam)
            ->setAwayTeam($this->awayTeam)
            ->setGameType($gameType)
            ->setCalendarEvent($calendarEvent);
        $this->em->persist($this->game);

        // ── Coach dem homeTeam zuweisen ──────────────────────────────────────
        $this->homeCoach = (new Coach())
            ->setFirstName('Test')
            ->setLastName('Coach-' . $suffix);
        $this->em->persist($this->homeCoach);

        $coachAssignment = new CoachTeamAssignment();
        $coachAssignment->setCoach($this->homeCoach);
        $coachAssignment->setTeam($this->homeTeam);
        $this->homeCoach->addCoachTeamAssignment($coachAssignment);
        $this->em->persist($coachAssignment);

        // ── Spieler dem homeTeam zuweisen ────────────────────────────────────
        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        self::assertNotNull($position, 'Keine Fixture-Position vorhanden. Bitte Fixtures laden.');

        $this->homePlayer = (new Player())
            ->setFirstName('Test')
            ->setLastName('Player-' . $suffix)
            ->setMainPosition($position);
        $this->em->persist($this->homePlayer);

        $playerAssignment = new PlayerTeamAssignment();
        $playerAssignment->setPlayer($this->homePlayer);
        $playerAssignment->setTeam($this->homeTeam);
        $this->homePlayer->addPlayerTeamAssignment($playerAssignment);
        $this->em->persist($playerAssignment);

        $this->em->flush();

        // user21@example.com hat ROLE_SUPERADMIN → Voter greift sofort an
        $this->superAdminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        self::assertNotNull($this->superAdminUser, 'Fixture-User user21@example.com (ROLE_SUPERADMIN) nicht gefunden. Bitte Fixtures laden.');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }

    private function getEventTypeId(?string $code = null): ?int
    {
        $criteria = null !== $code ? ['code' => $code] : [];
        $type = $this->em->getRepository(GameEventType::class)->findOneBy($criteria);

        return $type?->getId();
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function postEvent(array $payload): void
    {
        $this->client->request(
            'POST',
            '/api/game/' . $this->game->getId() . '/event',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode($payload)
        );
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    public function testAddEventRequiresAuthentication(): void
    {
        $this->client->request(
            'POST',
            '/api/game/' . $this->game->getId() . '/event',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['eventType' => 1, 'minute' => 1])
        );
        // JWT-Guard gibt 401 zurück wenn kein Token vorhanden
        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testAddEventResponseContainsEventId(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        $this->postEvent([
            'eventType' => $typeId,
            'player' => $this->homePlayer->getId(),
            'minute' => 10,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertArrayHasKey('eventId', $data, 'Die Antwort muss das Feld "eventId" enthalten.');
        self::assertIsInt($data['eventId'], '"eventId" muss ein Integer sein.');
        self::assertGreaterThan(0, $data['eventId'], '"eventId" muss > 0 sein (persistierte Event-ID).');
    }

    public function testAddEventResponseContainsSuccessTrue(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        $this->postEvent([
            'eventType' => $typeId,
            'player' => $this->homePlayer->getId(),
            'minute' => 5,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertArrayHasKey('success', $data);
        self::assertTrue($data['success']);
    }

    public function testAddEventEventIdMatchesPersisted(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        $this->postEvent([
            'eventType' => $typeId,
            'player' => $this->homePlayer->getId(),
            'minute' => 20,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $returnedId = $data['eventId'];

        $gameEvent = $this->em->find(GameEvent::class, $returnedId);
        self::assertNotNull($gameEvent, 'Das Spielereignis mit der zurückgegebenen eventId muss in der DB vorhanden sein.');
        self::assertSame($this->game->getId(), $gameEvent->getGame()->getId());
        self::assertSame($this->homePlayer->getId(), $gameEvent->getPlayer()?->getId());
    }

    public function testAddEventPlayerTeamIsAutomaticallyResolved(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        // Kein "team" im Request – muss aus Spieler-Teamzuordnung ermittelt werden
        $this->postEvent([
            'eventType' => $typeId,
            'player' => $this->homePlayer->getId(),
            'minute' => 15,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $event = $this->em->find(GameEvent::class, $data['eventId']);

        self::assertNotNull($event, 'Das Spielereignis muss in der DB vorhanden sein.');
        self::assertInstanceOf(GameEvent::class, $event);
        self::assertSame($this->homeTeam->getId(), $event->getTeam()->getId(), 'Das Team muss automatisch aus der Spieler-Teamzuordnung ermittelt werden.');
    }

    // ── Coach-Ereignisse ───────────────────────────────────────────────────────

    public function testAddEventWithCoachContainsEventId(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        $this->postEvent([
            'eventType' => $typeId,
            'coach' => $this->homeCoach->getId(),
            'minute' => 30,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);

        self::assertArrayHasKey('eventId', $data, 'Die Antwort muss "eventId" auch bei Coach-Ereignissen enthalten.');
        self::assertIsInt($data['eventId']);
        self::assertGreaterThan(0, $data['eventId']);
    }

    public function testAddEventWithCoachContainsSuccessTrue(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        $this->postEvent([
            'eventType' => $typeId,
            'coach' => $this->homeCoach->getId(),
            'minute' => 30,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        self::assertTrue($data['success'] ?? false);
    }

    public function testCoachYellowCardEventIsPersisted(): void
    {
        $typeId = $this->getEventTypeId('yellow_card');
        if (null === $typeId) {
            $this->markTestSkipped('GameEventType "yellow_card" nicht in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        $this->postEvent([
            'eventType' => $typeId,
            'coach' => $this->homeCoach->getId(),
            'minute' => 45,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $event = $this->em->find(GameEvent::class, $data['eventId']);

        self::assertNotNull($event, 'Das Coach-Ereignis muss persistiert sein.');
        self::assertSame($this->homeCoach->getId(), $event->getCoach()?->getId(), 'Der Coach muss am Ereignis gesetzt sein.');
        self::assertNull($event->getPlayer(), 'Bei Coach-Ereignissen darf kein Spieler gesetzt sein.');
    }

    public function testCoachEventTeamIsAutomaticallyResolved(): void
    {
        $typeId = $this->getEventTypeId();
        if (null === $typeId) {
            $this->markTestSkipped('Kein GameEventType in Fixtures vorhanden.');
        }

        $this->authenticate($this->superAdminUser);
        // Kein "team" im Request – muss aus Coach-Teamzuordnung ermittelt werden
        $this->postEvent([
            'eventType' => $typeId,
            'coach' => $this->homeCoach->getId(),
            'minute' => 60,
        ]);

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $event = $this->em->find(GameEvent::class, $data['eventId']);

        self::assertNotNull($event, 'Das Spielereignis muss in der DB vorhanden sein.');
        self::assertInstanceOf(GameEvent::class, $event);
        self::assertSame($this->homeTeam->getId(), $event->getTeam()->getId(), 'Das Team muss automatisch aus der Coach-Teamzuordnung ermittelt werden.');
    }

    // ── Fehlerbehandlung ───────────────────────────────────────────────────────

    public function testAddEventReturnsBadRequestForInvalidData(): void
    {
        $this->authenticate($this->superAdminUser);
        $this->client->request(
            'POST',
            '/api/game/' . $this->game->getId() . '/event',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            'invalid-json'
        );

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }
}
