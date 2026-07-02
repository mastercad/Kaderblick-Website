<?php

namespace Tests\Feature;

use App\Entity\Game;
use App\Entity\User;
use App\Entity\Video;
use App\Entity\VideoSegment;
use App\Entity\VideoType;
use DateTimeImmutable;
use ReflectionClass;
use Symfony\Component\HttpFoundation\Response;

class VideoSegmentControllerTest extends ApiWebTestCase
{
    private static int $videoCounter = 0;

    private function createTestVideo(): Video
    {
        $em = static::getContainer()->get('doctrine')->getManager();

        // Hole ein existierendes Game (aus Fixtures)
        $game = $em->getRepository(Game::class)->findOneBy([]);
        if (!$game) {
            $this->fail('Keine Games in der Datenbank gefunden. Bitte Fixtures laden.');
        }

        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);
        if (!$user) {
            $this->fail('User user21@example.com nicht gefunden. Bitte Fixtures laden.');
        }

        $videoType = $em->getRepository(VideoType::class)->findOneBy([]);
        if (!$videoType) {
            $this->fail('Kein VideoType in der Datenbank gefunden. Bitte Fixtures laden.');
        }

        // Eindeutigen Sort-Wert ermitteln, um UniqueConstraint (game_id, sort) nicht zu verletzen
        $maxSort = $em->getConnection()->fetchOne(
            'SELECT COALESCE(MAX(sort), 0) FROM videos WHERE game_id = ?',
            [$game->getId()]
        );
        ++self::$videoCounter;
        $uniqueSort = ((int) $maxSort) + self::$videoCounter;

        $video = new Video();
        $video->setName('Test Video ' . $uniqueSort);
        $video->setGame($game);
        $video->setCreatedFrom($user);
        $video->setCreatedAt(new DateTimeImmutable());
        $video->setUpdatedAt(new DateTimeImmutable());
        $video->setVideoType($videoType);
        $video->setLength(600);
        $video->setSort($uniqueSort);

        $em->persist($video);
        $em->flush();

        return $video;
    }

    public function testUserCanCreateVideoSegment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();

        $client->request('POST', '/video-segments/save', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'videoId' => $video->getId(),
            'startMinute' => 5.5,
            'lengthSeconds' => 120,
            'title' => 'Erstes Tor',
            'subTitle' => 'Minute 15',
            'includeAudio' => true,
            'sortOrder' => 0,
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_CREATED);

        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('id', $response);
        $this->assertEquals($video->getId(), $response['videoId']);
        $this->assertEquals(5.5, $response['startMinute']);
        $this->assertEquals(120, $response['lengthSeconds']);
        $this->assertEquals('Erstes Tor', $response['title']);
        $this->assertEquals('Minute 15', $response['subTitle']);
        $this->assertTrue($response['includeAudio']);
    }

    public function testUserCanListVideoSegmentsByGame(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        // Erstelle zwei Segmente
        $segment1 = new VideoSegment();
        $segment1->setVideo($video);
        $segment1->setUser($user);
        $segment1->setStartMinute(2.0);
        $segment1->setLengthSeconds(60);
        $segment1->setTitle('Segment 1');
        $segment1->setIncludeAudio(true);
        $segment1->setSortOrder(0);

        $segment2 = new VideoSegment();
        $segment2->setVideo($video);
        $segment2->setUser($user);
        $segment2->setStartMinute(5.5);
        $segment2->setLengthSeconds(120);
        $segment2->setTitle('Segment 2');
        $segment2->setIncludeAudio(false);
        $segment2->setSortOrder(1);

        $em->persist($segment1);
        $em->persist($segment2);
        $em->flush();

        $client->request('GET', '/video-segments?gameId=' . $video->getGame()->getId());

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertIsArray($response);
        $this->assertCount(2, $response);
        $this->assertEquals('Segment 1', $response[0]['title']);
        $this->assertEquals('Segment 2', $response[1]['title']);
    }

    public function testUserCanListVideoSegmentsByVideo(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        $segment = new VideoSegment();
        $segment->setVideo($video);
        $segment->setUser($user);
        $segment->setStartMinute(3.0);
        $segment->setLengthSeconds(90);
        $segment->setIncludeAudio(true);
        $segment->setSortOrder(0);

        $em->persist($segment);
        $em->flush();

        $client->request('GET', '/video-segments?videoId=' . $video->getId());

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertIsArray($response);
        $this->assertCount(1, $response);
        $this->assertEquals($video->getId(), $response[0]['videoId']);
    }

    public function testUserCanGetSingleVideoSegment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        $segment = new VideoSegment();
        $segment->setVideo($video);
        $segment->setUser($user);
        $segment->setStartMinute(7.25);
        $segment->setLengthSeconds(150);
        $segment->setTitle('Test Segment');
        $segment->setSubTitle('Test Sub');
        $segment->setIncludeAudio(true);
        $segment->setSortOrder(0);

        $em->persist($segment);
        $em->flush();

        $client->request('GET', '/video-segments/' . $segment->getId());

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals($segment->getId(), $response['id']);
        $this->assertEquals(7.25, $response['startMinute']);
        $this->assertEquals(150, $response['lengthSeconds']);
        $this->assertEquals('Test Segment', $response['title']);
        $this->assertEquals('Test Sub', $response['subTitle']);
    }

    public function testUserCanUpdateVideoSegment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        $segment = new VideoSegment();
        $segment->setVideo($video);
        $segment->setUser($user);
        $segment->setStartMinute(1.0);
        $segment->setLengthSeconds(60);
        $segment->setTitle('Original Title');
        $segment->setIncludeAudio(true);
        $segment->setSortOrder(0);

        $em->persist($segment);
        $em->flush();

        $client->request('POST', '/video-segments/update/' . $segment->getId(), [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'startMinute' => 2.5,
            'lengthSeconds' => 90,
            'title' => 'Updated Title',
            'includeAudio' => false,
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertEquals(2.5, $response['startMinute']);
        $this->assertEquals(90, $response['lengthSeconds']);
        $this->assertEquals('Updated Title', $response['title']);
        $this->assertFalse($response['includeAudio']);
    }

    public function testUserCanDeleteVideoSegment(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        $segment = new VideoSegment();
        $segment->setVideo($video);
        $segment->setUser($user);
        $segment->setStartMinute(1.0);
        $segment->setLengthSeconds(60);
        $segment->setIncludeAudio(true);
        $segment->setSortOrder(0);

        $em->persist($segment);
        $em->flush();

        $segmentId = $segment->getId();

        $client->request('POST', '/video-segments/delete/' . $segmentId);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Verify segment was deleted
        $em->clear();
        $deletedSegment = $em->getRepository(VideoSegment::class)->find($segmentId);
        $this->assertNull($deletedSegment);
    }

    public function testUserCannotAccessOtherUsersSegment(): void
    {
        $client = static::createClient();

        // Create segment as user16
        $this->authenticateUser($client, 'user21@example.com');
        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user16 = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        $segment = new VideoSegment();
        $segment->setVideo($video);
        $segment->setUser($user16);
        $segment->setStartMinute(1.0);
        $segment->setLengthSeconds(60);
        $segment->setIncludeAudio(true);
        $segment->setSortOrder(0);

        $em->persist($segment);
        $em->flush();

        // Try to access as different user
        $this->authenticateUser($client, 'user1@example.com');

        $client->request('GET', '/video-segments/' . $segment->getId());
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);

        $client->request('POST', '/video-segments/update/' . $segment->getId(), [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['startMinute' => 5.0]));
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);

        $client->request('POST', '/video-segments/delete/' . $segment->getId());
        $this->assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testUserCanExportVideoSegmentsAsCSV(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();
        $em = static::getContainer()->get('doctrine')->getManager();
        $user = $em->getRepository(User::class)->findOneBy(['email' => 'user21@example.com']);

        // Create multiple segments
        $segment1 = new VideoSegment();
        $segment1->setVideo($video);
        $segment1->setUser($user);
        $segment1->setStartMinute(5.833);
        $segment1->setLengthSeconds(250);
        $segment1->setTitle('Game Title');
        $segment1->setIncludeAudio(true);
        $segment1->setSortOrder(0);

        $segment2 = new VideoSegment();
        $segment2->setVideo($video);
        $segment2->setUser($user);
        $segment2->setStartMinute(10.75);
        $segment2->setLengthSeconds(135);
        $segment2->setIncludeAudio(true);
        $segment2->setSortOrder(1);

        $em->persist($segment1);
        $em->persist($segment2);
        $em->flush();

        // Store game ID
        $gameId = $video->getGame()->getId();

        $client->request('GET', '/video-segments/export/' . $gameId);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $this->assertResponseHeaderSame('Content-Type', 'text/csv; charset=utf-8');

        // For StreamedResponse in tests, we need to manually execute the callback using Reflection
        $response = $client->getResponse();
        $this->assertInstanceOf(\Symfony\Component\HttpFoundation\StreamedResponse::class, $response);

        // Use reflection to access the private callback property
        $reflection = new ReflectionClass($response);
        $callbackProperty = $reflection->getProperty('callback');
        $callbackProperty->setAccessible(true);
        $callback = $callbackProperty->getValue($response);

        // Execute the callback to get the CSV content
        ob_start();
        $callback();
        $content = ob_get_clean();

        // Verify CSV structure
        $lines = explode("\n", trim($content));
        $this->assertGreaterThanOrEqual(3, count($lines)); // Header + 2 data rows

        // Check header
        $this->assertStringContainsString('videoname', $lines[0]);
        $this->assertStringContainsString('start_minute', $lines[0]);
        $this->assertStringContainsString('length_seconds', $lines[0]);

        // Check first data row contains correct data
        $this->assertStringContainsString($video->getName(), $lines[1]);
        $this->assertStringContainsString('5,833', $lines[1]); // Decimal with comma
        $this->assertStringContainsString('250', $lines[1]);
    }

    public function testCreateSegmentValidatesRequiredFields(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $video = $this->createTestVideo();

        // Missing startMinute
        $client->request('POST', '/video-segments/save', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'videoId' => $video->getId(),
            'lengthSeconds' => 120,
        ]));

        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function testUnauthenticatedUserCannotAccessSegments(): void
    {
        self::ensureKernelShutdown();
        $client = static::createClient();

        $client->request('GET', '/video-segments?gameId=1');
        // Accept both 401 (API) and 302 (redirect) - depends on security config
        $this->assertTrue(
            in_array($client->getResponse()->getStatusCode(), [Response::HTTP_FOUND, Response::HTTP_UNAUTHORIZED]),
            'Expected 302 or 401, got ' . $client->getResponse()->getStatusCode()
        );

        self::ensureKernelShutdown();
        $client = static::createClient();
        $client->request('POST', '/video-segments/save');
        $this->assertTrue(
            in_array($client->getResponse()->getStatusCode(), [Response::HTTP_FOUND, Response::HTTP_UNAUTHORIZED]),
            'Expected 302 or 401, got ' . $client->getResponse()->getStatusCode()
        );
    }

    public function testListSegmentsRequiresGameIdOrVideoId(): void
    {
        $client = static::createClient();
        $this->authenticateUser($client, 'user21@example.com');

        $client->request('GET', '/video-segments');
        $this->assertResponseStatusCodeSame(Response::HTTP_BAD_REQUEST);
    }

    public function tearDown(): void
    {
        $em = self::$kernel->getContainer()->get('doctrine')->getManager();
        $connection = $em->getConnection();
        $connection->executeStatement('DELETE FROM video_segments');
        $connection->executeStatement("DELETE FROM videos WHERE name LIKE 'Test Video %'");

        parent::tearDown();
    }
}
