<?php

declare(strict_types=1);

namespace Tests\Feature\Controller;

use App\Entity\AgeGroup;
use App\Entity\Team;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Feature tests for GamesController::schedulePdf().
 *
 * GET /api/games/schedule/pdf?teamId=<int>&season=<int>
 *
 * All database changes are wrapped in a transaction and rolled back in tearDown.
 */
class GamesControllerPdfTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    private User $regularUser;
    private Team $team;
    private string $emailSuffix;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->emailSuffix = bin2hex(random_bytes(6));

        $ageGroup = $this->em->getRepository(AgeGroup::class)->findOneBy([]);
        self::assertNotNull($ageGroup, 'Keine Fixture-AgeGroup. Bitte Fixtures laden.');

        $this->team = (new Team())
            ->setName('test-pdf-team-' . $this->emailSuffix)
            ->setAgeGroup($ageGroup);
        $this->em->persist($this->team);
        $this->em->flush();

        $this->regularUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user6@example.com']);
        self::assertNotNull($this->regularUser, 'Fixture-User user6@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    // ── Auth & input validation ───────────────────────────────────────────────

    public function testRequiresAuthentication(): void
    {
        $this->client->request('GET', '/api/games/schedule/pdf?teamId=' . $this->team->getId() . '&season=2025');

        self::assertResponseStatusCodeSame(Response::HTTP_UNAUTHORIZED);
    }

    public function testReturnsBadRequestWhenTeamIdIsMissing(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/api/games/schedule/pdf?season=2025');

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
        $data = json_decode((string) $this->client->getResponse()->getContent(), true);
        self::assertArrayHasKey('error', $data);
    }

    public function testReturnsBadRequestWhenTeamIdIsZero(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/api/games/schedule/pdf?teamId=0&season=2025');

        self::assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testReturnsNotFoundForNonExistentTeam(): void
    {
        $this->authenticate($this->regularUser);

        $this->client->request('GET', '/api/games/schedule/pdf?teamId=999999&season=2025');

        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
        $data = json_decode((string) $this->client->getResponse()->getContent(), true);
        self::assertArrayHasKey('error', $data);
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    public function testReturnsPdfForAuthenticatedUser(): void
    {
        $this->authenticate($this->regularUser);

        $teamId = $this->team->getId();
        $this->client->request('GET', '/api/games/schedule/pdf?teamId=' . $teamId . '&season=2025');

        self::assertResponseStatusCodeSame(Response::HTTP_OK);
        self::assertStringContainsString(
            'application/pdf',
            (string) $this->client->getResponse()->headers->get('Content-Type'),
        );
    }

    public function testPdfResponseIsNonEmpty(): void
    {
        $this->authenticate($this->regularUser);

        $teamId = $this->team->getId();
        $this->client->request('GET', '/api/games/schedule/pdf?teamId=' . $teamId . '&season=2025');

        self::assertResponseIsSuccessful();
        self::assertNotEmpty($this->client->getResponse()->getContent());
    }

    public function testPdfContentDispositionContainsFilename(): void
    {
        $this->authenticate($this->regularUser);

        $teamId = $this->team->getId();
        $this->client->request('GET', '/api/games/schedule/pdf?teamId=' . $teamId . '&season=2025');

        self::assertResponseIsSuccessful();
        $disposition = (string) $this->client->getResponse()->headers->get('Content-Disposition');
        self::assertStringContainsString('Spielplan_', $disposition);
        self::assertStringContainsString('.pdf', $disposition);
    }

    public function testSeasonDefaultsToCurrentSeasonWhenOmitted(): void
    {
        $this->authenticate($this->regularUser);

        $teamId = $this->team->getId();
        // Omit season — the controller should compute a default and still return 200
        $this->client->request('GET', '/api/games/schedule/pdf?teamId=' . $teamId);

        self::assertResponseStatusCodeSame(Response::HTTP_OK);
        self::assertStringContainsString(
            'application/pdf',
            (string) $this->client->getResponse()->headers->get('Content-Type'),
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $token = $jwtManager->create($user);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . $token);
    }
}
