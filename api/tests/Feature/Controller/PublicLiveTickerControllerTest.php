<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\GameType;
use App\Entity\Team;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

final class PublicLiveTickerControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private Game $game;
    private string $token;
    private User $admin;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $suffix = bin2hex(random_bytes(5));
        $this->token = str_repeat('a', 38) . $suffix;
        $gameType = $this->em->getRepository(GameType::class)->findOneBy([]);
        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        $calendarType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        $goalType = $this->em->getRepository(GameEventType::class)->findOneBy(['code' => 'goal']);
        self::assertNotNull($gameType);
        self::assertNotNull($ageGroup);
        self::assertNotNull($calendarType);
        self::assertNotNull($goalType);

        $home = (new Team())->setName('Ticker Heim ' . $suffix)->setAgeGroup($ageGroup);
        $away = (new Team())->setName('Ticker Gast ' . $suffix)->setAgeGroup($ageGroup);
        $this->em->persist($home);
        $this->em->persist($away);

        $calendarEvent = (new CalendarEvent())
            ->setTitle('Ticker-Test')
            ->setStartDate(new DateTime('-30 minutes'))
            ->setEndDate(new DateTime('+60 minutes'))
            ->setCalendarEventType($calendarType);
        $this->em->persist($calendarEvent);

        $this->game = (new Game())
            ->setHomeTeam($home)
            ->setAwayTeam($away)
            ->setGameType($gameType)
            ->setCalendarEvent($calendarEvent)
            ->setPublicLiveTickerToken($this->token)
            ->setPublicLiveTickerEnabled(true);
        $this->em->persist($this->game);

        $event = (new GameEvent())
            ->setGame($this->game)
            ->setGameEventType($goalType)
            ->setTeam($home)
            ->setTimestamp(new DateTime('-10 minutes'))
            ->setDescription('Schöner Angriff über rechts');
        $this->em->persist($event);
        $this->em->flush();

        $this->admin = $this->em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        self::assertNotNull($this->admin);
    }

    public function testPublicTickerIsAccessibleWithoutAuthenticationAndDataMinimized(): void
    {
        $this->client->request('GET', '/api/public/live-ticker/' . $this->token);

        self::assertResponseIsSuccessful();
        self::assertStringContainsString(
            'no-store',
            (string) $this->client->getResponse()->headers->get('Cache-Control')
        );
        $data = json_decode((string) $this->client->getResponse()->getContent(), true);

        self::assertSame('live', $data['game']['status']);
        self::assertSame(1, $data['game']['homeScore']);
        self::assertSame(0, $data['game']['awayScore']);
        self::assertSame('Schöner Angriff über rechts', $data['events'][0]['description']);
        self::assertArrayNotHasKey('player', $data['events'][0]);
        self::assertArrayNotHasKey('coach', $data['events'][0]);
        self::assertArrayNotHasKey('permissions', $data['game']);
        self::assertArrayNotHasKey('matchPlan', $data['game']);
    }

    public function testDisabledTickerReturnsNotFound(): void
    {
        $this->game->setPublicLiveTickerEnabled(false);
        $this->em->flush();

        $this->client->request('GET', '/api/public/live-ticker/' . $this->token);
        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testAdminCanDisableTickerWithoutChangingToken(): void
    {
        $jwt = static::getContainer()->get(JWTTokenManagerInterface::class)->create($this->admin);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $jwt);
        $this->client->jsonRequest('PATCH', '/api/games/' . $this->game->getId() . '/public-live-ticker', ['enabled' => false]);

        self::assertResponseIsSuccessful();
        $disabled = json_decode((string) $this->client->getResponse()->getContent(), true);
        self::assertFalse($disabled['enabled']);
        self::assertSame($this->token, $disabled['token']);
    }

    public function testEnablingTickerCreatesAnUnguessablePublicPath(): void
    {
        $this->game
            ->setPublicLiveTickerEnabled(false)
            ->setPublicLiveTickerToken(null);
        $this->em->flush();

        $jwt = static::getContainer()->get(JWTTokenManagerInterface::class)->create($this->admin);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $jwt);
        $this->client->jsonRequest('PATCH', '/api/games/' . $this->game->getId() . '/public-live-ticker', ['enabled' => true]);

        self::assertResponseIsSuccessful();
        $enabled = json_decode((string) $this->client->getResponse()->getContent(), true);
        self::assertTrue($enabled['enabled']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{48}$/', $enabled['token']);
        self::assertSame('/live/' . $enabled['token'], $enabled['publicPath']);
    }

    protected function tearDown(): void
    {
        if (isset($this->em) && $this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }
}
