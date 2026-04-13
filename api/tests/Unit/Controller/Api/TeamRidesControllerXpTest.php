<?php

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\TeamRidesController;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Event\CarpoolOfferedEvent;
use App\Repository\CalendarEventRepository;
use App\Repository\TeamRideRepository;
use App\Service\NotificationService;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Tests that TeamRidesController::add() dispatches CarpoolOfferedEvent
 * after a ride is successfully created.
 */
#[AllowMockObjectsWithoutExpectations]
class TeamRidesControllerXpTest extends TestCase
{
    private TeamRidesController $controller;
    private EventDispatcherInterface&MockObject $dispatcher;
    private CalendarEventRepository&MockObject $eventRepo;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $teamRideRepo = $this->createMock(TeamRideRepository::class);
        $this->eventRepo = $this->createMock(CalendarEventRepository::class);
        $notificationService = $this->createMock(NotificationService::class);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);
        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $this->controller = new TeamRidesController(
            $em,
            $teamRideRepo,
            $this->eventRepo,
            $notificationService,
            $this->dispatcher,
        );
    }

    public function testDispatchesCarpoolOfferedEventAfterRideIsCreated(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getFullName')->willReturn('Test Driver');

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn(10);
        $event->method('getTitle')->willReturn('Auswärtsspiel');
        // Return empty collection so getTeamUsersForEvent() skips all DB queries
        $event->method('getPermissions')->willReturn(new ArrayCollection());

        $this->eventRepo->method('find')->with(10)->willReturn($event);

        $this->wireUser($user);

        // Authorization: allow ride creation
        $this->authChecker
            ->method('isGranted')
            ->willReturn(true);

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(CarpoolOfferedEvent::class));

        $request = new Request(
            content: json_encode(['event_id' => 10, 'seats' => 3, 'note' => 'Treffpunkt Marktplatz']),
        );

        $this->controller->add($request);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private function wireUser(User $user): void
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->authChecker);

        $this->controller->setContainer($container);
    }
}
