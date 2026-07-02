<?php

namespace Tests\Feature\Controller;

use App\Entity\SupporterRequest;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserTeamSupporterAssignment;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

class SupporterRequestControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
    }

    public function testMineReturnsEligibleTeamsFromUserRelations(): void
    {
        $user = $this->loadUser('user11@example.com');
        $this->authenticate($user);

        $this->client->request('GET', '/api/supporter-request/mine');

        self::assertResponseIsSuccessful();
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertNotEmpty($data['eligibleTeams']);
        self::assertArrayHasKey('id', $data['eligibleTeams'][0]);
        self::assertArrayHasKey('name', $data['eligibleTeams'][0]);
    }

    public function testSubmitRejectsTeamWithoutUserRelation(): void
    {
        $user = $this->loadUser('user11@example.com');
        $eligibleTeam = $this->firstEligibleTeam($user);
        $otherTeam = $this->em->getRepository(Team::class)->createQueryBuilder('t')
            ->where('t != :team')
            ->setParameter('team', $eligibleTeam)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
        self::assertInstanceOf(Team::class, $otherTeam);

        $this->authenticate($user);
        $this->client->request(
            'POST',
            '/api/supporter-request',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['teamId' => $otherTeam->getId()], JSON_THROW_ON_ERROR),
        );

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testApprovalCreatesScopedTeamSupporterAssignment(): void
    {
        $user = $this->loadUser('user11@example.com');
        $team = $this->firstEligibleTeam($user);
        $admin = $this->loadUser('user21@example.com');

        $this->authenticate($user);
        $this->client->request(
            'POST',
            '/api/supporter-request',
            server: ['CONTENT_TYPE' => 'application/json'],
            content: json_encode(['teamId' => $team->getId(), 'note' => 'Ich helfe beim Spiel.'], JSON_THROW_ON_ERROR),
        );
        self::assertResponseStatusCodeSame(Response::HTTP_CREATED);
        $data = json_decode($this->client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame($team->getId(), $data['request']['team']['id']);

        $request = $this->em->getRepository(SupporterRequest::class)->find($data['request']['id']);
        self::assertInstanceOf(SupporterRequest::class, $request);

        $this->authenticate($admin);
        $this->client->request('POST', '/admin/supporter-requests/' . $request->getId() . '/approve');

        self::assertResponseIsSuccessful();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $user = $this->em->find(User::class, $user->getId());
        self::assertInstanceOf(User::class, $user);
        self::assertSame(['ROLE_USER', 'ROLE_SUPPORTER'], $user->getRoles());
        self::assertNotNull($this->em->getRepository(UserTeamSupporterAssignment::class)->findOneBy([
            'user' => $user,
            'team' => $team,
        ]));
    }

    private function authenticate(User $user): void
    {
        $jwtManager = static::getContainer()->get(JWTTokenManagerInterface::class);
        $this->client->setServerParameter('HTTP_Authorization', 'Bearer ' . $jwtManager->create($user));
    }

    private function loadUser(string $email): User
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        self::assertInstanceOf(User::class, $user);

        return $user;
    }

    private function firstEligibleTeam(User $user): Team
    {
        foreach ($user->getUserRelations() as $relation) {
            $coach = $relation->getCoach();
            if (null !== $coach) {
                foreach ($coach->getCoachTeamAssignments() as $assignment) {
                    if ($assignment->getTeam()) {
                        return $assignment->getTeam();
                    }
                }
            }

            $player = $relation->getPlayer();
            if (null !== $player) {
                foreach ($player->getPlayerTeamAssignments() as $assignment) {
                    if ($assignment->getTeam()) {
                        return $assignment->getTeam();
                    }
                }
            }
        }

        self::fail('Fixture user has no eligible team.');
    }
}
