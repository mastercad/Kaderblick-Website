<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\Team;
use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature tests for TeamSizeGuideController.
 *
 * Endpoints covered:
 *   GET /api/teams/size-guide-overview
 *   GET /api/teams/{teamId}/size-guide-pdf
 *
 * Fixture assumptions (from TestData fixtures, group "test"):
 *   user11@example.com  – ROLE_CLUB, self_coach → coach_1 → Team 1 (active)
 *   user12@example.com  – ROLE_CLUB, self_coach → coach_5 → Team 2 (active)
 *   user13@example.com  – ROLE_CLUB, self_coach → coach_8 → Team 1 (expired 2020-12-31)
 *   user6@example.com   – ROLE_USER, no coach relation
 *
 * Each test wraps any implicit DB state in a rolled-back transaction so that
 * no fixture data is permanently modified.
 */
class TeamSizeGuideControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }

        parent::tearDown();
        restore_exception_handler();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private function authenticate(string $email): void
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertNotNull(
            $user,
            sprintf('Fixture-User "%s" nicht gefunden. Bitte Fixtures laden (--group=master --group=test).', $email),
        );

        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $jwtManager->create($user));
    }

    /** @return array<mixed> */
    private function decodeJson(): array
    {
        /* @var array<mixed> */
        return json_decode((string) $this->client->getResponse()->getContent(), true);
    }

    private function team1(): ?Team
    {
        return $this->em->getRepository(Team::class)->findOneBy(['name' => 'Team 1']);
    }

    private function team2(): ?Team
    {
        return $this->em->getRepository(Team::class)->findOneBy(['name' => 'Team 2']);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /api/teams/size-guide-overview
    // ═════════════════════════════════════════════════════════════════════════

    public function testOverviewRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/teams/size-guide-overview');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testOverviewReturnsSuccessfulJsonArray(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        self::assertResponseIsSuccessful();
        $this->decodeJson();
    }

    public function testOverviewReturnsAtLeastOneTeamForActiveCoach(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $data = $this->decodeJson();

        $this->assertNotEmpty($data, 'An active coach must see at least one team.');
    }

    public function testOverviewTeamEntryHasRequiredFields(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $team = $this->decodeJson()[0];

        $this->assertArrayHasKey('team_id', $team);
        $this->assertArrayHasKey('team_name', $team);
        $this->assertArrayHasKey('players', $team);
        $this->assertIsInt($team['team_id']);
        $this->assertIsString($team['team_name']);
        $this->assertIsArray($team['players']);
    }

    public function testOverviewTeamIdIsPositiveInteger(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $team = $this->decodeJson()[0];

        $this->assertGreaterThan(0, $team['team_id']);
    }

    public function testOverviewPlayerEntryHasAllSizeFields(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $players = $this->decodeJson()[0]['players'] ?? [];

        if (empty($players)) {
            $this->markTestSkipped('No players with self_player relation found in fixture for Team 1.');
        }

        $p = $players[0];

        foreach (['id', 'name', 'shorts_size', 'shirt_size', 'shoe_size', 'socks_size', 'jacket_size'] as $field) {
            $this->assertArrayHasKey($field, $p, "Player entry is missing field: $field");
        }
    }

    public function testOverviewPlayerShoeAndSocksAreStringOrNull(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $players = $this->decodeJson()[0]['players'] ?? [];

        if (empty($players)) {
            $this->markTestSkipped('No players in fixture for Team 1.');
        }

        foreach ($players as $p) {
            $this->assertTrue(
                null === $p['shoe_size'] || is_string($p['shoe_size']),
                'shoe_size must be string|null',
            );
            $this->assertTrue(
                null === $p['socks_size'] || is_string($p['socks_size']),
                'socks_size must be string|null',
            );
        }
    }

    public function testOverviewReturnsEmptyArrayForNonCoachUser(): void
    {
        $this->authenticate('user6@example.com'); // ROLE_USER, no coach relation
        $this->client->request('GET', '/api/teams/size-guide-overview');

        self::assertResponseIsSuccessful();
        $this->assertSame([], $this->decodeJson());
    }

    public function testOverviewExcludesTeamsWithExpiredCoachAssignment(): void
    {
        // user13@example.com → coach_8 → Team 1, assignment expired 2020-12-31
        $this->authenticate('user13@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        self::assertResponseIsSuccessful();
        $this->assertSame([], $this->decodeJson(), 'Expired coach assignment must not appear in overview.');
    }

    public function testOverviewCoachOnlySeesOwnTeams(): void
    {
        // user11 coaches Team 1; user12 coaches Team 2.
        // user11 must NOT see Team 2 in their overview.
        $team2 = $this->team2();
        if (null === $team2) {
            $this->markTestSkipped('Team 2 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $teamIds = array_column($this->decodeJson(), 'team_id');

        $this->assertNotContains($team2->getId(), $teamIds, 'A coach must not see another coach\'s teams.');
    }

    public function testOverviewResponseIsContentTypeJson(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/size-guide-overview');

        $contentType = (string) $this->client->getResponse()->headers->get('Content-Type');

        $this->assertStringContainsString('application/json', $contentType);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // GET /api/teams/{teamId}/size-guide-pdf
    // ═════════════════════════════════════════════════════════════════════════

    public function testPdfRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/teams/1/size-guide-pdf');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testPdfReturnsNotFoundForNonExistentTeamId(): void
    {
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/999999/size-guide-pdf');

        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testPdfReturnsNotFoundWhenCoachRequestsForeignTeam(): void
    {
        $team2 = $this->team2();
        if (null === $team2) {
            $this->markTestSkipped('Team 2 not found in fixture data.');
        }

        // user11 coaches Team 1 – Team 2 belongs to user12 (coach_5)
        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team2->getId() . '/size-guide-pdf');

        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    public function testPdfReturnsPdfContentTypeForOwnTeam(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        self::assertResponseStatusCodeSame(Response::HTTP_OK);
        $this->assertStringContainsString(
            'application/pdf',
            (string) $this->client->getResponse()->headers->get('Content-Type'),
        );
    }

    public function testPdfResponseBodyIsNonEmpty(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        self::assertResponseIsSuccessful();
        $this->assertNotEmpty($this->client->getResponse()->getContent());
    }

    public function testPdfBodyStartsWithPdfMagicBytes(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        self::assertResponseIsSuccessful();
        $this->assertStringStartsWith('%PDF', $this->client->getResponse()->getContent());
    }

    public function testPdfContentDispositionContainsExpectedPrefix(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        $disposition = (string) $this->client->getResponse()->headers->get('Content-Disposition');

        $this->assertStringContainsString('Bestelluebersicht_', $disposition);
        $this->assertStringContainsString('.pdf', $disposition);
    }

    public function testPdfContentDispositionContainsCurrentDate(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        $disposition = (string) $this->client->getResponse()->headers->get('Content-Disposition');
        $todayYmd = (new DateTime())->format('Y-m-d');

        $this->assertStringContainsString($todayYmd, $disposition);
    }

    public function testPdfContentLengthHeaderMatchesBodyLength(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        self::assertResponseIsSuccessful();

        $contentLength = (int) $this->client->getResponse()->headers->get('Content-Length');
        $bodyLength = strlen($this->client->getResponse()->getContent());

        $this->assertSame($bodyLength, $contentLength);
    }

    public function testPdfIsInlineDisposition(): void
    {
        $team1 = $this->team1();
        if (null === $team1) {
            $this->markTestSkipped('Team 1 not found in fixture data.');
        }

        $this->authenticate('user11@example.com');
        $this->client->request('GET', '/api/teams/' . $team1->getId() . '/size-guide-pdf');

        $disposition = (string) $this->client->getResponse()->headers->get('Content-Disposition');

        $this->assertStringStartsWith('inline', $disposition);
    }

    public function testPdfSecondCoachCanAccessOwnTeam(): void
    {
        $team2 = $this->team2();
        if (null === $team2) {
            $this->markTestSkipped('Team 2 not found in fixture data.');
        }

        $this->authenticate('user12@example.com'); // self_coach → coach_5 → Team 2
        $this->client->request('GET', '/api/teams/' . $team2->getId() . '/size-guide-pdf');

        self::assertResponseStatusCodeSame(Response::HTTP_OK);
        $this->assertStringContainsString(
            'application/pdf',
            (string) $this->client->getResponse()->headers->get('Content-Type'),
        );
    }
}
