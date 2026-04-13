<?php

namespace App\Tests\Unit\Controller;

use App\Controller\ApiResource\TacticPresetController;
use App\Entity\Club;
use App\Entity\TacticPreset;
use App\Entity\User;
use App\Repository\TacticPresetRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

#[AllowMockObjectsWithoutExpectations]
class TacticPresetControllerTest extends TestCase
{
    private TacticPresetRepository&MockObject $presetRepository;
    private EntityManagerInterface&MockObject $entityManager;
    private TacticPresetController $controller;

    // -----------------------------------------------------------------
    // Setup helpers
    // -----------------------------------------------------------------

    protected function setUp(): void
    {
        $this->presetRepository = $this->createMock(TacticPresetRepository::class);
        $this->entityManager = $this->createMock(EntityManagerInterface::class);

        $this->controller = new TacticPresetController(
            $this->presetRepository,
            $this->entityManager
        );
    }

    /**
     * Wire a user (or null) into the controller container so getUser() works.
     */
    private function setAuthenticatedUser(?User $user): void
    {
        if (null === $user) {
            $token = null;
        } else {
            $token = $this->createMock(TokenInterface::class);
            $token->method('getUser')->willReturn($user);
        }

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }

    /**
     * Create a minimal User mock with no club assignments.
     */
    private function makeUser(int $id = 1, string $firstName = 'Max', string $lastName = 'Mustermann'): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getFirstName')->willReturn($firstName);
        $user->method('getLastName')->willReturn($lastName);
        $user->method('getUserRelations')->willReturn(new ArrayCollection());

        return $user;
    }

    // -----------------------------------------------------------------
    // Helpers: build Request
    // -----------------------------------------------------------------

    /**
     * @param array<string, mixed> $body
     */
    private function jsonRequest(string $method, array $body): Request
    {
        $request = Request::create('/', $method, [], [], [], [], json_encode($body));
        $request->headers->set('Content-Type', 'application/json');

        return $request;
    }

    // -----------------------------------------------------------------
    // GET /api/tactic-presets (index)
    // -----------------------------------------------------------------

    public function testIndexReturns401WhenNotAuthenticated(): void
    {
        $this->setAuthenticatedUser(null);

        $response = $this->controller->index();

        $this->assertSame(Response::HTTP_UNAUTHORIZED, $response->getStatusCode());

        $body = json_decode((string) $response->getContent(), true);
        $this->assertArrayHasKey('error', $body);
    }

    public function testIndexReturnsJsonArrayForAuthenticatedUser(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $preset = $this->createMock(TacticPreset::class);
        $preset->method('toArray')->willReturn([
            'id' => 1,
            'title' => 'Gegenpressing',
            'category' => 'Pressing',
            'description' => '',
            'isSystem' => true,
            'clubId' => null,
            'createdBy' => null,
            'canDelete' => false,
            'data' => [],
            'createdAt' => '2026-03-14T10:00:00+00:00',
        ]);

        $this->presetRepository
            ->method('findVisibleForUser')
            ->willReturn([$preset]);

        $response = $this->controller->index();

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertIsArray($body);
        $this->assertCount(1, $body);
        $this->assertSame('Gegenpressing', $body[0]['title']);
    }

    public function testIndexReturnsEmptyArrayWhenNoPresetsVisible(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $this->presetRepository->method('findVisibleForUser')->willReturn([]);

        $response = $this->controller->index();

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertSame([], $body);
    }

    // -----------------------------------------------------------------
    // POST /api/tactic-presets (create)
    // -----------------------------------------------------------------

    public function testCreateReturns401WhenNotAuthenticated(): void
    {
        $this->setAuthenticatedUser(null);

        $response = $this->controller->create(
            $this->jsonRequest('POST', ['title' => 'X', 'category' => 'Pressing', 'data' => []])
        );

        $this->assertSame(Response::HTTP_UNAUTHORIZED, $response->getStatusCode());
    }

    public function testCreateReturns400ForInvalidJson(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $request = Request::create('/', 'POST', [], [], [], [], '{ not valid json }');
        $response = $this->controller->create($request);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());

        $body = json_decode((string) $response->getContent(), true);
        $this->assertSame('Invalid JSON', $body['error']);
    }

    public function testCreateReturns400WhenTitleIsMissing(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $response = $this->controller->create(
            $this->jsonRequest('POST', ['category' => 'Pressing', 'data' => ['name' => 'X', 'elements' => [], 'opponents' => []]])
        );

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturns400WhenTitleIsBlank(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $response = $this->controller->create(
            $this->jsonRequest('POST', ['title' => '   ', 'category' => 'Pressing', 'data' => []])
        );

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturns400WhenCategoryIsMissing(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $response = $this->controller->create(
            $this->jsonRequest('POST', ['title' => 'Vorlage', 'data' => []])
        );

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturns400ForInvalidCategory(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $response = $this->controller->create(
            $this->jsonRequest('POST', [
                'title' => 'Vorlage',
                'category' => 'Ungueltig',
                'data' => ['name' => 'Vorlage', 'elements' => [], 'opponents' => []],
            ])
        );

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());

        $body = json_decode((string) $response->getContent(), true);
        $this->assertStringContainsString('Invalid category', $body['error']);
    }

    public function testCreateReturns400WhenDataIsNotArray(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $response = $this->controller->create(
            $this->jsonRequest('POST', [
                'title' => 'Vorlage',
                'category' => 'Pressing',
                'data' => 'kein-array',
            ])
        );

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreatePersistsAndReturns201(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $this->entityManager->expects($this->once())->method('persist');
        $this->entityManager->expects($this->once())->method('flush');

        $response = $this->controller->create(
            $this->jsonRequest('POST', [
                'title' => 'Meine Vorlage',
                'category' => TacticPreset::CATEGORY_ATTACK,
                'description' => 'Testbeschreibung',
                'shareWithClub' => false,
                'data' => ['name' => 'Meine Vorlage', 'elements' => [], 'opponents' => []],
            ])
        );

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());

        $body = json_decode((string) $response->getContent(), true);
        $this->assertSame('Meine Vorlage', $body['title']);
        $this->assertSame(TacticPreset::CATEGORY_ATTACK, $body['category']);
        $this->assertFalse($body['isSystem']);
    }

    public function testCreateWithAllValidCategories(): void
    {
        foreach (TacticPreset::CATEGORIES as $category) {
            $user = $this->makeUser();
            $this->setAuthenticatedUser($user);

            // Reset mock expectations for each iteration
            $this->entityManager = $this->createMock(EntityManagerInterface::class);
            $this->controller = new TacticPresetController($this->presetRepository, $this->entityManager);
            $this->setAuthenticatedUser($user);

            $response = $this->controller->create(
                $this->jsonRequest('POST', [
                    'title' => 'Taktik ' . $category,
                    'category' => $category,
                    'data' => ['name' => 'Taktik', 'elements' => [], 'opponents' => []],
                ])
            );

            $this->assertSame(
                Response::HTTP_CREATED,
                $response->getStatusCode(),
                "Expected 201 for valid category '$category'"
            );
        }
    }

    // -----------------------------------------------------------------
    // DELETE /api/tactic-presets/{id} (delete)
    // -----------------------------------------------------------------

    public function testDeleteReturns401WhenNotAuthenticated(): void
    {
        $this->setAuthenticatedUser(null);

        $preset = new TacticPreset();
        $response = $this->controller->delete($preset);

        $this->assertSame(Response::HTTP_UNAUTHORIZED, $response->getStatusCode());
    }

    public function testDeleteReturns403ForSystemPreset(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $preset = new TacticPreset();
        $preset->setTitle('System');
        $preset->setIsSystem(true);

        $response = $this->controller->delete($preset);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testDeleteReturns403WhenDifferentUserOwnsPreset(): void
    {
        $owner = $this->makeUser(1);

        $requestor = $this->makeUser(2);
        $this->setAuthenticatedUser($requestor);

        $preset = new TacticPreset();
        $preset->setTitle('Fremde Vorlage');
        $preset->setIsSystem(false);
        $preset->setCreatedBy($owner);

        $response = $this->controller->delete($preset);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testDeleteReturns403WhenPresetHasNoCreator(): void
    {
        $user = $this->makeUser();
        $this->setAuthenticatedUser($user);

        $preset = new TacticPreset();
        $preset->setTitle('Waisenvorlage');
        $preset->setIsSystem(false);
        // createdBy = null (orphan preset, no known owner)

        $response = $this->controller->delete($preset);

        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testDeleteReturns204WhenOwnerDeletes(): void
    {
        $user = $this->makeUser(1);
        $this->setAuthenticatedUser($user);

        $preset = new TacticPreset();
        $preset->setTitle('Meine Vorlage');
        $preset->setIsSystem(false);
        $preset->setCreatedBy($user);

        $this->entityManager->expects($this->once())->method('remove')->with($preset);
        $this->entityManager->expects($this->once())->method('flush');

        $response = $this->controller->delete($preset);

        $this->assertSame(Response::HTTP_NO_CONTENT, $response->getStatusCode());
    }
}
