<?php

namespace App\Tests\Unit\Controller;

use App\Controller\ProfileController;
use App\Entity\User;
use App\Event\ProfileCompletenessReachedEvent;
use App\Event\ProfileUpdatedEvent;
use App\Service\CoachTeamPlayerService;
use App\Service\EmailVerificationService;
use App\Service\SystemSettingService;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use stdClass;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Validator\ConstraintViolationListInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Tests that ProfileController::updateProfile() dispatches the correct XP events.
 *
 * Covers:
 *  - ProfileUpdatedEvent is always dispatched on a successful update
 *  - ProfileCompletenessReachedEvent is dispatched for each milestone reached
 *  - No milestone event is dispatched when the profile is incomplete
 */
#[AllowMockObjectsWithoutExpectations]
class ProfileControllerXpTest extends TestCase
{
    private ProfileController $controller;
    private EventDispatcherInterface&MockObject $dispatcher;
    private ValidatorInterface&MockObject $validator;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $passwordHasher = $this->createMock(UserPasswordHasherInterface::class);
        $this->validator = $this->createMock(ValidatorInterface::class);
        $emailVerificationService = $this->createMock(EmailVerificationService::class);
        $coachTeamPlayerService = $this->createMock(CoachTeamPlayerService::class);
        $systemSettingService = $this->createMock(SystemSettingService::class);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);

        // Validation passes by default (no violations)
        $violations = $this->createMock(ConstraintViolationListInterface::class);
        $violations->method('count')->willReturn(0);
        $this->validator->method('validate')->willReturn($violations);

        $this->controller = new ProfileController(
            $em,
            $passwordHasher,
            $this->validator,
            $emailVerificationService,
            $coachTeamPlayerService,
            $systemSettingService,
            $this->dispatcher,
        );
    }

    // ─── ProfileUpdatedEvent ──────────────────────────────────────────────────

    public function testDispatchesProfileUpdatedEventOnSuccessfulUpdate(): void
    {
        $user = $this->makeUser(complete: false);
        $this->wireUser($user);

        $dispatchedEvents = [];
        $this->dispatcher
            ->method('dispatch')
            ->willReturnCallback(function (object $event) use (&$dispatchedEvents): object {
                $dispatchedEvents[] = $event;

                return $event;
            });

        $request = new Request(content: json_encode(['firstName' => 'Max']));
        $this->controller->updateProfile($request);

        $types = array_map(fn ($e) => get_class($e), $dispatchedEvents);
        $this->assertContains(ProfileUpdatedEvent::class, $types);
    }

    // ─── ProfileCompletenessReachedEvent ──────────────────────────────────────

    public function testDispatchesMilestoneEventsWhenProfileIsFullyComplete(): void
    {
        $user = $this->makeUser(complete: true);
        $this->wireUser($user);

        $dispatchedEvents = [];
        $this->dispatcher
            ->method('dispatch')
            ->willReturnCallback(function (object $event) use (&$dispatchedEvents): object {
                $dispatchedEvents[] = $event;

                return $event;
            });

        $request = new Request(content: json_encode(['firstName' => 'Max']));
        $this->controller->updateProfile($request);

        $milestoneEvents = array_values(array_filter(
            $dispatchedEvents,
            fn ($e) => $e instanceof ProfileCompletenessReachedEvent,
        ));

        // 100% completeness → milestones 25, 50, 75, 100 are all dispatched
        $this->assertCount(4, $milestoneEvents);

        $milestones = array_map(fn ($e) => $e->getMilestone(), $milestoneEvents);
        $this->assertEqualsCanonicalizing([25, 50, 75, 100], $milestones);
    }

    public function testNoMilestoneEventsDispatchedWhenProfileIsEmpty(): void
    {
        $user = $this->makeUser(complete: false);
        $this->wireUser($user);

        $dispatchedEvents = [];
        $this->dispatcher
            ->method('dispatch')
            ->willReturnCallback(function (object $event) use (&$dispatchedEvents): object {
                $dispatchedEvents[] = $event;

                return $event;
            });

        $request = new Request(content: json_encode(['firstName' => 'Max']));
        $this->controller->updateProfile($request);

        $milestoneEvents = array_filter(
            $dispatchedEvents,
            fn ($e) => $e instanceof ProfileCompletenessReachedEvent,
        );

        // With empty profile, completeness = 0 → no milestones reached
        $this->assertCount(0, $milestoneEvents);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /**
     * Creates a user mock.
     *
     * @param bool $complete when true, all "completeness" fields return non-null/non-empty values
     */
    private function makeUser(bool $complete): User&MockObject
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getEmail')->willReturn($complete ? 'test@example.com' : '');
        $user->method('getFirstName')->willReturn($complete ? 'Max' : null);
        $user->method('getLastName')->willReturn($complete ? 'Mustermann' : null);
        $user->method('getAvatarFilename')->willReturn($complete ? 'avatar.jpg' : null);
        $user->method('getHeight')->willReturn($complete ? 180.0 : null);
        $user->method('getWeight')->willReturn($complete ? 75.0 : null);
        $user->method('getShoeSize')->willReturn($complete ? 42.0 : null);
        $user->method('getShirtSize')->willReturn($complete ? 'M' : null);
        $user->method('getPantsSize')->willReturn($complete ? '32' : null);
        $user->method('getUserRelations')->willReturn(
            $complete ? new ArrayCollection([new stdClass()]) : new ArrayCollection(),
        );

        return $user;
    }

    private function wireUser(User $user): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }
}
