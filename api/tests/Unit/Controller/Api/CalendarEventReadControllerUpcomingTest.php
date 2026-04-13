<?php

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\Calendar\CalendarEventReadController;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Repository\CalendarEventRepository;
use App\Service\CalendarEventSerializer;
use App\Service\SystemSettingService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit tests for the /api/calendar/upcoming endpoint.
 *
 * Key assertions:
 *  - SystemSettingService::getMatchdayLookaheadDays() is called to get the
 *    window size.
 *  - CalendarEventRepository::findUpcoming() is called with limit=20 and the
 *    returned lookahead days value.
 *  - Each event is serialized via CalendarEventSerializer::serialize().
 *  - The response is a JSON array.
 */
#[AllowMockObjectsWithoutExpectations]
class CalendarEventReadControllerUpcomingTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private CalendarEventSerializer&MockObject $serializer;
    private SystemSettingService&MockObject $systemSettingService;
    private CalendarEventRepository&MockObject $calendarEventRepo;
    private CalendarEventReadController $controller;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->serializer = $this->createMock(CalendarEventSerializer::class);
        $this->systemSettingService = $this->createMock(SystemSettingService::class);
        $this->calendarEventRepo = $this->createMock(CalendarEventRepository::class);

        // getRepository(CalendarEventType::class) → returns a repo whose findOneBy returns null
        $eventTypeRepo = $this->createMock(EntityRepository::class);
        $eventTypeRepo->method('findOneBy')->willReturn(null);
        $this->em->method('getRepository')->willReturn($eventTypeRepo);

        $this->controller = new CalendarEventReadController(
            $this->em,
            $this->serializer,
            $this->systemSettingService
        );

        // Minimal container so AbstractController::json() works
        $container = new ContainerBuilder();
        $container->set(
            'serializer',
            new class {
                /** @param array<string, mixed> $context */
                public function serialize(mixed $data, string $format, array $context = []): string
                {
                    return json_encode($data, JSON_THROW_ON_ERROR);
                }
            }
        );

        // Token storage (getUser returns null – not needed in upcoming endpoint)
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn(null);
        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);
        $container->set('security.token_storage', $tokenStorage);

        // Authorization checker (not used in this endpoint)
        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }

    // ── getMatchdayLookaheadDays() is called ───────────────────────────────────

    public function testRetrieveUpcomingEventsCallsGetMatchdayLookaheadDays(): void
    {
        $this->systemSettingService
            ->expects($this->once())
            ->method('getMatchdayLookaheadDays')
            ->willReturn(7);

        $this->calendarEventRepo->method('findUpcoming')->willReturn([]);

        $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);
    }

    // ── findUpcoming receives the correct arguments ────────────────────────────

    public function testRetrieveUpcomingEventsCallsFindUpcomingWithLimit20AndLookaheadDays(): void
    {
        $lookaheadDays = 14;
        $this->systemSettingService->method('getMatchdayLookaheadDays')->willReturn($lookaheadDays);

        $this->calendarEventRepo
            ->expects($this->once())
            ->method('findUpcoming')
            ->with(20, $lookaheadDays)
            ->willReturn([]);

        $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);
    }

    public function testRetrieveUpcomingEventsPassesDefaultLookaheadToFindUpcoming(): void
    {
        $this->systemSettingService->method('getMatchdayLookaheadDays')->willReturn(7);

        $this->calendarEventRepo
            ->expects($this->once())
            ->method('findUpcoming')
            ->with(20, 7)
            ->willReturn([]);

        $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);
    }

    // ── Serializer is called for each event ───────────────────────────────────

    public function testRetrieveUpcomingEventsSerializesEachEvent(): void
    {
        $event1 = $this->createMock(CalendarEvent::class);
        $event2 = $this->createMock(CalendarEvent::class);

        $this->systemSettingService->method('getMatchdayLookaheadDays')->willReturn(7);
        $this->calendarEventRepo->method('findUpcoming')->willReturn([$event1, $event2]);

        $this->serializer
            ->expects($this->exactly(2))
            ->method('serialize')
            ->willReturn(['id' => 1, 'title' => 'Test']);

        $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);
    }

    // ── Response is always an array ────────────────────────────────────────────

    public function testRetrieveUpcomingEventsReturnJsonResponse(): void
    {
        $this->systemSettingService->method('getMatchdayLookaheadDays')->willReturn(7);
        $this->calendarEventRepo->method('findUpcoming')->willReturn([]);

        $response = $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);

        $this->assertSame(200, $response->getStatusCode());
        $decoded = json_decode($response->getContent(), true);
        $this->assertIsArray($decoded);
    }

    public function testRetrieveUpcomingEventsReturnsEmptyArrayWhenNoEvents(): void
    {
        $this->systemSettingService->method('getMatchdayLookaheadDays')->willReturn(7);
        $this->calendarEventRepo->method('findUpcoming')->willReturn([]);

        $response = $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);
        $decoded = json_decode($response->getContent(), true);

        $this->assertSame([], $decoded['events']);
    }

    public function testRetrieveUpcomingEventsContainsSerializedData(): void
    {
        $event = $this->createMock(CalendarEvent::class);
        $serialized = ['id' => 99, 'title' => 'Heimspiel', 'start' => '2026-05-01T15:00:00'];

        $this->systemSettingService->method('getMatchdayLookaheadDays')->willReturn(7);
        $this->calendarEventRepo->method('findUpcoming')->willReturn([$event]);
        $this->serializer->method('serialize')->willReturn($serialized);

        $response = $this->controller->retrieveUpcomingEvents($this->calendarEventRepo);
        $decoded = json_decode($response->getContent(), true);

        $this->assertCount(1, $decoded['events']);
        $this->assertSame(99, $decoded['events'][0]['id']);
        $this->assertSame('Heimspiel', $decoded['events'][0]['title']);
    }
}
