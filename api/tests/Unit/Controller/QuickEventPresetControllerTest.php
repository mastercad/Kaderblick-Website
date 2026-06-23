<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\ApiResource\QuickEventPresetController;
use App\Entity\QuickEventPreset;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\QuickEventPresetRepository;
use App\Repository\UserRepository;
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
class QuickEventPresetControllerTest extends TestCase
{
    private QuickEventPresetRepository & MockObject $presetRepo;
    private UserRepository & MockObject $userRepo;
    private EntityManagerInterface & MockObject $em;
    private QuickEventPresetController $controller;
    private AuthorizationCheckerInterface & MockObject $authChecker;

    protected function setUp(): void
    {
        $this->presetRepo = $this->createMock(QuickEventPresetRepository::class);
        $this->userRepo = $this->createMock(UserRepository::class);
        $this->em = $this->createMock(EntityManagerInterface::class);

        $this->controller = new QuickEventPresetController($this->em);
    }

    // ── Container / auth wiring ───────────────────────────────────────────

    /**
     * Wire user and role grants into the controller container.
     *
     * @param string[] $grantedRoles roles that isGranted() should return true for
     */
    private function wireAuth(?User $user, array $grantedRoles = []): void
    {
        if (null === $user) {
            $token = null;
        } else {
            $token = $this->createMock(TokenInterface::class);
            $token->method('getUser')->willReturn($user);
        }

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $this->authChecker->method('isGranted')->willReturnCallback(
            static fn (string $attr) => in_array($attr, $grantedRoles, true)
        );

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);
    }

    /** Build a User stub with a coach relation so assertAccess() passes. */
    private function makeCoachUser(int $id = 1): User & MockObject
    {
        $relationType = $this->createStub(RelationType::class);
        $relationType->method('getCategory')->willReturn('coach');

        $relation = $this->createStub(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getUserRelations')->willReturn(new ArrayCollection([$relation]));

        return $user;
    }

    /** Build a User stub with no coach relation. */
    private function makeRegularUser(int $id = 99): User & MockObject
    {
        $relationType = $this->createStub(RelationType::class);
        $relationType->method('getCategory')->willReturn('player');

        $relation = $this->createStub(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getUserRelations')->willReturn(new ArrayCollection([$relation]));

        return $user;
    }

    /**
     * @param array<string, mixed> $body
     */
    private function jsonRequest(string $method, array $body): Request
    {
        $request = Request::create('/', $method, [], [], [], [], json_encode($body));
        $request->headers->set('Content-Type', 'application/json');

        return $request;
    }

    private function makePreset(User $owner, int $id = 1): QuickEventPreset & MockObject
    {
        $preset = $this->createMock(QuickEventPreset::class);
        $preset->method('getOwner')->willReturn($owner);
        $preset->method('toArray')->willReturn([
            'id' => $id,
            'name' => 'Test',
            'config' => [],
            'isActive' => false,
            'ownerId' => $owner->getId(),
            'sharedWithUserIds' => [],
            'createdAt' => '2026-05-12T09:00:00+00:00',
            'updatedAt' => '2026-05-12T09:00:00+00:00',
        ]);

        return $preset;
    }

    // ── GET /list ─────────────────────────────────────────────────────────

    public function testListDeniedForUnauthenticatedUser(): void
    {
        $this->wireAuth(null);
        $response = $this->controller->list($this->presetRepo);
        $this->assertSame(Response::HTTP_UNAUTHORIZED, $response->getStatusCode());
    }

    public function testListDeniedForUserWithoutCoachRelation(): void
    {
        $user = $this->makeRegularUser();
        $this->wireAuth($user, []);

        $response = $this->controller->list($this->presetRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testListCallsFindForUserForCoach(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $this->presetRepo->expects($this->once())
            ->method('findForUser')
            ->with($user)
            ->willReturn([$preset]);

        $response = $this->controller->list($this->presetRepo);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertCount(1, $body['presets']);
    }

    public function testListCallsFindAllForAdmin(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, ['ROLE_SUPERADMIN']);

        $preset = $this->makePreset($user);
        $this->presetRepo->expects($this->once())
            ->method('findAll')
            ->willReturn([$preset]);
        $this->presetRepo->expects($this->never())->method('findForUser');

        $response = $this->controller->list($this->presetRepo);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    public function testListReturnsEmptyPresetsArrayForCoachWithNoPresets(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('findForUser')->willReturn([]);

        $response = $this->controller->list($this->presetRepo);
        $body = json_decode((string) $response->getContent(), true);
        $this->assertSame([], $body['presets']);
    }

    // ── POST /create ──────────────────────────────────────────────────────

    public function testCreateReturnsBadRequestWhenNameEmpty(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);

        $response = $this->controller->create($this->jsonRequest('POST', ['name' => '', 'config' => []]));
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreateReturnsBadRequestWhenConfigNotArray(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);

        $response = $this->controller->create($this->jsonRequest('POST', ['name' => 'Test', 'config' => 'string']));
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testCreatePersistsAndReturns201(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->create(
            $this->jsonRequest('POST', ['name' => 'Mein Preset', 'config' => ['buttons' => []]])
        );

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
        $body = json_decode((string) $response->getContent(), true);
        $this->assertSame('Mein Preset', $body['name']);
    }

    public function testCreateSetsCurrentUserAsOwner(): void
    {
        $user = $this->makeCoachUser(5);
        $user->method('getId')->willReturn(5);
        $this->wireAuth($user, []);

        $this->em->method('persist');
        $this->em->method('flush');

        $response = $this->controller->create(
            $this->jsonRequest('POST', ['name' => 'Owned', 'config' => []])
        );

        $body = json_decode((string) $response->getContent(), true);
        $this->assertSame(5, $body['ownerId']);
    }

    // ── PUT /update ───────────────────────────────────────────────────────

    public function testUpdateReturns404WhenPresetNotFound(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('find')->willReturn(null);

        $response = $this->controller->update(99, $this->jsonRequest('PUT', []), $this->presetRepo);
        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testUpdateReturns403WhenNotOwnerAndNotAdmin(): void
    {
        $owner = $this->makeCoachUser(1);
        $other = $this->makeCoachUser(2);
        $this->wireAuth($other, []);

        $preset = $this->makePreset($owner);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->update(1, $this->jsonRequest('PUT', ['name' => 'X']), $this->presetRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testUpdateAllowedForOwner(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $preset->expects($this->once())->method('setName')->with('Neu');
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->update(1, $this->jsonRequest('PUT', ['name' => 'Neu']), $this->presetRepo);
        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    public function testUpdateAllowedForAdmin(): void
    {
        $owner = $this->makeCoachUser(1);
        $admin = $this->makeCoachUser(2);
        $this->wireAuth($admin, ['ROLE_SUPERADMIN']);

        $preset = $this->makePreset($owner);
        $preset->method('setName');
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->method('flush');

        $response = $this->controller->update(1, $this->jsonRequest('PUT', ['name' => 'Admin Edit']), $this->presetRepo);
        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    public function testUpdateReturnsBadRequestWhenNameBlank(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->update(1, $this->jsonRequest('PUT', ['name' => '   ']), $this->presetRepo);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testUpdateReturnsBadRequestWhenConfigNotArray(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->update(1, $this->jsonRequest('PUT', ['config' => 'bad']), $this->presetRepo);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    // ── DELETE ────────────────────────────────────────────────────────────

    public function testDeleteReturns404WhenNotFound(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('find')->willReturn(null);

        $response = $this->controller->delete(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testDeleteReturns403ForNonOwner(): void
    {
        $owner = $this->makeCoachUser(1);
        $other = $this->makeCoachUser(2);
        $this->wireAuth($other, []);

        $preset = $this->makePreset($owner);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->delete(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testDeleteReturns204ForOwner(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->expects($this->once())->method('remove')->with($preset);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->delete(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_NO_CONTENT, $response->getStatusCode());
    }

    public function testDeleteAllowedForAdmin(): void
    {
        $owner = $this->makeCoachUser(1);
        $admin = $this->makeCoachUser(2);
        $this->wireAuth($admin, ['ROLE_SUPERADMIN']);

        $preset = $this->makePreset($owner);
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->method('remove');
        $this->em->method('flush');

        $response = $this->controller->delete(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_NO_CONTENT, $response->getStatusCode());
    }

    // ── POST /activate ────────────────────────────────────────────────────

    public function testActivateReturns404WhenNotFound(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('find')->willReturn(null);

        $response = $this->controller->activate(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testActivateReturns403ForNonOwner(): void
    {
        $owner = $this->makeCoachUser(1);
        $other = $this->makeCoachUser(2);
        $this->wireAuth($other, []);

        $preset = $this->makePreset($owner);
        $this->presetRepo->method('find')->willReturn($preset);
        $this->presetRepo->method('findAll')->willReturn([]);

        $response = $this->controller->activate(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testActivateSetsPresetActiveAndDeactivatesOthers(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $other = $this->makePreset($user, 2);
        $other->expects($this->once())->method('setActive')->with(false);

        $preset = $this->makePreset($user, 1);
        $preset->expects($this->once())->method('setActive')->with(true);

        $this->presetRepo->method('find')->willReturn($preset);
        $this->presetRepo->method('findAll')->willReturn([$other, $preset]);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->activate(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    // ── POST /deactivate ──────────────────────────────────────────────────

    public function testDeactivateReturns404WhenNotFound(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('find')->willReturn(null);

        $response = $this->controller->deactivate(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testDeactivateReturns403ForNonOwner(): void
    {
        $owner = $this->makeCoachUser(1);
        $other = $this->makeCoachUser(2);
        $this->wireAuth($other, []);

        $preset = $this->makePreset($owner);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->deactivate(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testDeactivateSetsActiveFalse(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $preset->expects($this->once())->method('setActive')->with(false);
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->deactivate(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    // ── POST /share ───────────────────────────────────────────────────────

    public function testShareReturns404WhenNotFound(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('find')->willReturn(null);

        $response = $this->controller->share(1, $this->jsonRequest('POST', ['userIds' => []]), $this->presetRepo, $this->userRepo);
        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testShareReturns403ForNonOwner(): void
    {
        $owner = $this->makeCoachUser(1);
        $other = $this->makeCoachUser(2);
        $this->wireAuth($other, []);

        $preset = $this->makePreset($owner);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->share(1, $this->jsonRequest('POST', ['userIds' => []]), $this->presetRepo, $this->userRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testShareReturnsBadRequestWhenUserIdsNotArray(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $preset = $this->makePreset($user);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->share(1, $this->jsonRequest('POST', ['userIds' => 'bad']), $this->presetRepo, $this->userRepo);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testShareClearsAndSetsSharedUsers(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $sharedUser = $this->createStub(User::class);
        $this->userRepo->method('find')->willReturn($sharedUser);

        $preset = $this->makePreset($user);
        $preset->expects($this->once())->method('clearSharedWith');
        $preset->expects($this->once())->method('addSharedWith')->with($sharedUser);
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->share(1, $this->jsonRequest('POST', ['userIds' => [42]]), $this->presetRepo, $this->userRepo);
        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    public function testShareSkipsUnknownUserIds(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $this->userRepo->method('find')->willReturn(null);

        $preset = $this->makePreset($user);
        $preset->expects($this->once())->method('clearSharedWith');
        $preset->expects($this->never())->method('addSharedWith');
        $this->presetRepo->method('find')->willReturn($preset);
        $this->em->method('flush');

        $response = $this->controller->share(1, $this->jsonRequest('POST', ['userIds' => [999]]), $this->presetRepo, $this->userRepo);
        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
    }

    // ── POST /copy ────────────────────────────────────────────────────────

    public function testCopyReturns404WhenNotFound(): void
    {
        $user = $this->makeCoachUser();
        $this->wireAuth($user, []);
        $this->presetRepo->method('find')->willReturn(null);

        $response = $this->controller->copy(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testCopyReturns403WhenNotOwnerAndNotShared(): void
    {
        $owner = $this->makeCoachUser(1);
        $other = $this->makeCoachUser(2);
        $this->wireAuth($other, []);

        $sharedWith = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $sharedWith->method('contains')->willReturn(false);

        $preset = $this->makePreset($owner);
        $preset->method('getSharedWith')->willReturn($sharedWith);
        $this->presetRepo->method('find')->willReturn($preset);

        $response = $this->controller->copy(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
    }

    public function testCopyAllowedForOwner(): void
    {
        $user = $this->makeCoachUser(1);
        $this->wireAuth($user, []);

        $sharedWith = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $sharedWith->method('contains')->willReturn(false);

        $preset = $this->makePreset($user);
        $preset->method('getName')->willReturn('Original');
        $preset->method('getConfig')->willReturn(['buttons' => []]);
        $preset->method('getSharedWith')->willReturn($sharedWith);
        $this->presetRepo->method('find')->willReturn($preset);

        $this->em->expects($this->once())->method('persist');
        $this->em->expects($this->once())->method('flush');

        $response = $this->controller->copy(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());

        $body = json_decode((string) $response->getContent(), true);
        $this->assertStringContainsString('Kopie', $body['name']);
    }

    public function testCopyAllowedForSharedUser(): void
    {
        $owner = $this->makeCoachUser(1);
        $sharedUser = $this->makeCoachUser(2);
        $this->wireAuth($sharedUser, []);

        $sharedWith = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $sharedWith->method('contains')->with($sharedUser)->willReturn(true);

        $preset = $this->makePreset($owner);
        $preset->method('getName')->willReturn('Shared');
        $preset->method('getConfig')->willReturn([]);
        $preset->method('getSharedWith')->willReturn($sharedWith);
        $this->presetRepo->method('find')->willReturn($preset);

        $this->em->method('persist');
        $this->em->method('flush');

        $response = $this->controller->copy(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
    }

    public function testCopyAllowedForAdmin(): void
    {
        $owner = $this->makeCoachUser(1);
        $admin = $this->makeCoachUser(2);
        $this->wireAuth($admin, ['ROLE_SUPERADMIN']);

        $sharedWith = $this->createMock(\Doctrine\Common\Collections\Collection::class);
        $sharedWith->method('contains')->willReturn(false);

        $preset = $this->makePreset($owner);
        $preset->method('getName')->willReturn('Admin Copy');
        $preset->method('getConfig')->willReturn([]);
        $preset->method('getSharedWith')->willReturn($sharedWith);
        $this->presetRepo->method('find')->willReturn($preset);

        $this->em->method('persist');
        $this->em->method('flush');

        $response = $this->controller->copy(1, $this->presetRepo);
        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
    }
}
