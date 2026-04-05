<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Location;
use App\Entity\User;
use App\Repository\ParticipationRepository;
use App\Service\CalendarEventSerializer;
use App\Service\TeamMembershipService;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Unit tests for CalendarEventSerializer::serialize().
 */
class CalendarEventSerializerTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private ParticipationRepository&MockObject $participationRepo;
    private TeamMembershipService&MockObject $membershipService;
    private Security&MockObject $security;
    private CalendarEventSerializer $serializer;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);

        $defaultRepo = $this->createMock(EntityRepository::class);
        $defaultRepo->method('findOneBy')->willReturn(null);
        $this->em->method('getRepository')->willReturn($defaultRepo);

        $this->participationRepo  = $this->createMock(ParticipationRepository::class);
        $this->participationRepo->method('findByUserAndEvent')->willReturn(null);

        $this->membershipService = $this->createMock(TeamMembershipService::class);
        $this->security          = $this->createMock(Security::class);

        $this->serializer = new CalendarEventSerializer(
            $this->em,
            $this->participationRepo,
            $this->membershipService,
            $this->security,
        );
    }

    // ─── Array structure ───────────────────────────────────────────────────────

    public function testSerializeReturnsExpectedTopLevelKeys(): void
    {
        $event = $this->makeBaseEvent();

        $result = $this->serializer->serialize($event, null, null);

        foreach (['id', 'title', 'start', 'end', 'permissions', 'location', 'cancelled'] as $key) {
            $this->assertArrayHasKey($key, $result, "Key '$key' must be present");
        }
    }

    public function testSerializeReturnsPermissionsSubkeys(): void
    {
        $event = $this->makeBaseEvent();

        $result = $this->serializer->serialize($event, null, null);

        $perms = $result['permissions'];
        foreach (['canCreate', 'canEdit', 'canDelete', 'canCancel', 'canViewRides', 'canParticipate'] as $key) {
            $this->assertArrayHasKey($key, $perms, "permissions.$key must be present");
        }
    }

    // ─── Default endDate ───────────────────────────────────────────────────────

    public function testSerializeDefaultEndDateIs235959WhenNotSet(): void
    {
        $event = new CalendarEvent();
        $event->setTitle('Event');
        $event->setStartDate(new DateTime('2026-05-07 18:00:00'));
        // No endDate set

        $result = $this->serializer->serialize($event, null, null);

        $this->assertStringEndsWith('T23:59:59', $result['end']);
        $this->assertStringStartsWith('2026-05-07', $result['end']);
    }

    public function testSerializeUsesActualEndDateWhenSet(): void
    {
        $event = $this->makeBaseEvent();
        $event->setEndDate(new DateTime('2026-05-07 19:30:00'));

        $result = $this->serializer->serialize($event, null, null);

        $this->assertSame('2026-05-07T19:30:00', $result['end']);
    }

    // ─── Location ─────────────────────────────────────────────────────────────

    public function testSerializeLocationIsNullWhenNotSet(): void
    {
        $event = $this->makeBaseEvent();

        $result = $this->serializer->serialize($event, null, null);

        $this->assertNull($result['location']);
    }

    public function testSerializeLocationStructureWhenSet(): void
    {
        $location = $this->createStub(Location::class);
        $location->method('getId')->willReturn(42);
        $location->method('getName')->willReturn('Sportplatz Nord');
        $location->method('getLatitude')->willReturn(52.5);
        $location->method('getLongitude')->willReturn(13.4);
        $location->method('getCity')->willReturn('Berlin');
        $location->method('getAddress')->willReturn('Musterstr. 1');

        $event = $this->makeBaseEvent();
        $event->setLocation($location);

        $result = $this->serializer->serialize($event, null, null);

        $this->assertSame(42, $result['location']['id']);
        $this->assertSame('Sportplatz Nord', $result['location']['name']);
        $this->assertSame('Berlin', $result['location']['city']);
    }

    // ─── canParticipate ────────────────────────────────────────────────────────

    public function testCanParticipateIsTrueForSuperAdmin(): void
    {
        $this->security->method('isGranted')->willReturnCallback(
            fn (string $attr) => 'ROLE_SUPERADMIN' === $attr
        );

        $event = $this->makeBaseEvent();
        $result = $this->serializer->serialize($event, null, null);

        $this->assertTrue($result['permissions']['canParticipate']);
    }

    public function testCanParticipateIsTrueWhenTeamMember(): void
    {
        $this->security->method('isGranted')->willReturn(false);

        $user = $this->createMock(User::class);
        $this->security->method('getUser')->willReturn($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(true);

        $event = $this->makeBaseEvent();
        $result = $this->serializer->serialize($event, $user, null);

        $this->assertTrue($result['permissions']['canParticipate']);
    }

    public function testCanParticipateIsFalseWhenNotTeamMember(): void
    {
        $this->security->method('isGranted')->willReturn(false);

        $user = $this->createMock(User::class);
        $this->security->method('getUser')->willReturn($user);
        $this->membershipService->method('canUserParticipateInEvent')->willReturn(false);

        $event = $this->makeBaseEvent();
        $result = $this->serializer->serialize($event, $user, null);

        $this->assertFalse($result['permissions']['canParticipate']);
    }

    public function testCanParticipateIsFalseForUnauthenticatedUser(): void
    {
        $this->security->method('isGranted')->willReturn(false);
        $this->security->method('getUser')->willReturn(null);

        $event = $this->makeBaseEvent();
        $result = $this->serializer->serialize($event, null, null);

        $this->assertFalse($result['permissions']['canParticipate']);
    }

    // ─── canViewRides ─────────────────────────────────────────────────────────

    public function testCanViewRidesIsTrueForSuperAdmin(): void
    {
        $this->security->method('isGranted')->willReturnCallback(
            fn (string $attr) => 'ROLE_SUPERADMIN' === $attr
        );

        $event = $this->makeBaseEvent();
        $result = $this->serializer->serialize($event, null, null);

        $this->assertTrue($result['permissions']['canViewRides']);
    }

    public function testCanViewRidesIsTrueWhenTeamMemberForEvent(): void
    {
        $this->security->method('isGranted')->willReturn(false);

        $user = $this->createMock(User::class);
        $this->security->method('getUser')->willReturn($user);
        $this->membershipService->method('isUserTeamMemberForEvent')->willReturn(true);

        $event = $this->makeBaseEvent();
        $result = $this->serializer->serialize($event, $user, null);

        $this->assertTrue($result['permissions']['canViewRides']);
    }

    // ─── Series fields ────────────────────────────────────────────────────────

    public function testSeriesFieldsArePresentInResult(): void
    {
        $event = $this->makeBaseEvent();
        $event->setTrainingSeriesId('uuid-series-abc');
        $event->setTrainingSeriesEndDate('2026-12-31');
        $event->setTrainingWeekdays([1, 3]);

        $result = $this->serializer->serialize($event, null, null);

        $this->assertSame('uuid-series-abc', $result['trainingSeriesId']);
        $this->assertSame('2026-12-31', $result['trainingSeriesEndDate']);
        $this->assertSame([1, 3], $result['trainingWeekdays']);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function makeBaseEvent(): CalendarEvent
    {
        $event = new CalendarEvent();
        $event->setTitle('Test-Event');
        $event->setStartDate(new DateTime('2026-05-07 18:00:00'));
        $event->setEndDate(new DateTime('2026-05-07 19:30:00'));

        return $event;
    }
}
