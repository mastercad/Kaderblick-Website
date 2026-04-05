<?php

namespace App\Tests\Unit\Controller;

use App\Controller\Api\Calendar\CalendarEventWriteController;
use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Event\CalendarEventCreatedEvent;
use App\Service\CalendarEventService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\ConstraintViolationList;

/**
 * Tests that CalendarController::createEvent() dispatches CalendarEventCreatedEvent
 * after a calendar event is successfully created.
 */
class CalendarControllerXpTest extends TestCase
{
    private CalendarEventWriteController $controller;
    private EventDispatcherInterface&MockObject $dispatcher;
    private CalendarEventService&MockObject $calendarEventService;
    private AuthorizationCheckerInterface&MockObject $authChecker;

    protected function setUp(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $this->calendarEventService = $this->createMock(CalendarEventService::class);
        $this->dispatcher = $this->createMock(EventDispatcherInterface::class);
        $this->authChecker = $this->createMock(AuthorizationCheckerInterface::class);

        $this->controller = new CalendarEventWriteController(
            $em,
            $this->calendarEventService,
            $this->dispatcher,
        );
    }

    public function testDispatchesCalendarEventCreatedEventOnSuccessfulCreate(): void
    {
        $user = $this->createMock(User::class);
        $calendarEvent = $this->createMock(CalendarEvent::class);

        $this->wireUser($user);

        // Authorization: allow event creation
        $this->authChecker
            ->method('isGranted')
            ->willReturn(true);

        // Serializer deserializes request body into a CalendarEvent
        $serializer = $this->createMock(SerializerInterface::class);
        $serializer
            ->method('deserialize')
            ->willReturn($calendarEvent);

        // No ownership error, no validation errors
        $this->calendarEventService
            ->method('validateMatchTeamOwnership')
            ->willReturn(null);

        $this->calendarEventService
            ->method('updateEventFromData')
            ->willReturn(new ConstraintViolationList());

        $this->dispatcher
            ->expects($this->once())
            ->method('dispatch')
            ->with($this->isInstanceOf(CalendarEventCreatedEvent::class));

        $request = new Request(content: json_encode([
            'title' => 'Testtraining',
            'startDate' => '2025-12-01T10:00:00',
        ]));

        $this->controller->createEvent($request, $serializer);
    }

    public function testNoEventDispatchedWhenAuthorizationDenied(): void
    {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $user = $this->createMock(User::class);

        $this->wireUser($user);

        // Authorization check fails → 403 returned before dispatch
        $this->authChecker
            ->method('isGranted')
            ->willReturn(false);

        $serializer = $this->createMock(SerializerInterface::class);
        $serializer->method('deserialize')->willReturn($calendarEvent);

        $this->dispatcher
            ->expects($this->never())
            ->method('dispatch');

        $request = new Request(content: json_encode(['title' => 'Testtraining']));

        $this->controller->createEvent($request, $serializer);
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
