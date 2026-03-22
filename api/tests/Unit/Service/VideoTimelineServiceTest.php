<?php

namespace App\Tests\Unit\Service;

use App\Entity\CalendarEvent;
use App\Entity\Camera;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Video;
use App\Security\Voter\VideoVoter;
use App\Service\VideoTimelineService;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Generator;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Unit-Tests für VideoTimelineService.
 *
 * Wichtige Invarianten:
 *  - GameEvent-Timestamps sind absolute Echtzeit-Datetimes (inkl. Halbzeitpause!).
 *  - Die Video-Timeline stapelt Videos nahtlos – OHNE Pause.
 *  - Für Events in der 2. Halbzeit muss daher die Pausendauer abgezogen werden.
 *  - Video.gameStart = Sekunden im Video bis Spielbeginn (Vorspann).
 *  - Mehrere Videos pro Kamera werden per Sort-Wert geordnet und nahtlos hintereinander gelegt.
 */
#[AllowMockObjectsWithoutExpectations]
class VideoTimelineServiceTest extends TestCase
{
    private Security&MockObject $security;
    private VideoTimelineService $service;

    protected function setUp(): void
    {
        $this->security = $this->createMock(Security::class);
        $this->security->method('isGranted')->willReturn(true);
        $this->service = new VideoTimelineService($this->security, -60);
    }

    // =========================================================================
    // Game-Entity: Defaults und getFirstHalfTotalSeconds
    // =========================================================================

    public function testGameEntityDefaults(): void
    {
        $game = new Game();

        $this->assertSame(45, $game->getHalfDuration());
        $this->assertSame(15, $game->getHalftimeBreakDuration());
        $this->assertNull($game->getFirstHalfExtraTime());
        $this->assertNull($game->getSecondHalfExtraTime());
    }

    public function testGetFirstHalfTotalSecondsDefault45(): void
    {
        $game = new Game();
        $game->setHalfDuration(45);

        $this->assertSame(2700, $game->getFirstHalfTotalSeconds());
    }

    public function testGetFirstHalfTotalSecondsWithExtraTime(): void
    {
        $game = new Game();
        $game->setHalfDuration(45);
        $game->setFirstHalfExtraTime(3);

        $this->assertSame(2880, $game->getFirstHalfTotalSeconds()); // (45+3)*60
    }

    public function testGetFirstHalfTotalSecondsYouthHalf(): void
    {
        $game = new Game();
        $game->setHalfDuration(35);

        $this->assertSame(2100, $game->getFirstHalfTotalSeconds()); // 35*60
    }

    public function testGetFirstHalfTotalSecondsNoExtraTimeIsNull(): void
    {
        $game = new Game();
        $game->setHalfDuration(45);
        // firstHalfExtraTime bleibt null → wird als 0 behandelt
        $this->assertSame(2700, $game->getFirstHalfTotalSeconds());
    }

    /**
     * secondHalfExtraTime darf firstHalfTotalSeconds NICHT beeinflussen;
     * die Grenze 1. HZ / 2. HZ bleibt bei (halfDuration + firstHalfExtraTime) * 60.
     */
    public function testSecondHalfExtraTimeDoesNotAffectFirstHalfTotalSeconds(): void
    {
        $game = new Game();
        $game->setHalfDuration(45);
        $game->setSecondHalfExtraTime(6);

        $this->assertSame(2700, $game->getFirstHalfTotalSeconds());
    }

    /**
     * Kombination: firstHalfExtraTime=3, secondHalfExtraTime=5 → boundary = (45+3)*60 = 2880.
     */
    public function testBothExtraTimesSetOnlyFirstHalfExtraTimeCountsForBoundary(): void
    {
        $game = new Game();
        $game->setHalfDuration(45);
        $game->setFirstHalfExtraTime(3);
        $game->setSecondHalfExtraTime(5);

        $this->assertSame(2880, $game->getFirstHalfTotalSeconds()); // nur +3, nicht +5
    }

    // =========================================================================
    // prepareYoutubeLinks – 1. Halbzeit (keine Pausenkorrektur)
    // =========================================================================

    /**
     * Event in der 10. Minute (600s Spielzeit).
     * firstHalfEndSeconds=2700 → 600 <= 2700 → keine Korrektur.
     *
     * gameStart=30: die ersten 30s des Videos sind Vorspann.
     * positionInVideo = 30 + 600 = 630, Offset -60 → 570
     */
    public function testFirstHalfEventNoPauseCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 3600,
            gameStart: 30,
        );
        $event = $this->makeEvent($kickOff, 600);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=570s'], $links[1][1]);
    }

    /**
     * Event genau bei 45:00 = 2700s → Grenzfall, noch 1. Halbzeit, keine Korrektur.
     */
    public function testEventAtExactFirstHalfEndBoundaryNoPauseCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 4000, gameStart: 0);
        $event = $this->makeEvent($kickOff, 2700);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // positionInVideo = 0+2700=2700, Offset -60 → 2640
        $this->assertSame(['https://youtu.be/abc&t=2640s'], $links[1][1]);
    }

    /**
     * Event bei 46:00 (2760s) mit firstHalfExtraTime=3 min → firstHalfEndSeconds=2880.
     * 2760 <= 2880 → noch 1. Halbzeit, keine Pausenkorrektur.
     */
    public function testEventInFirstHalfExtraTimeNoPauseCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 4000,
            gameStart: 0,
            halfDuration: 45,
            firstHalfExtraTime: 3,
        );
        $event = $this->makeEvent($kickOff, 2760); // 46. Minute

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // positionInVideo = 0+2760=2760, Offset -60 → 2700
        $this->assertSame(['https://youtu.be/abc&t=2700s'], $links[1][1]);
    }

    // =========================================================================
    // prepareYoutubeLinks – 2. Halbzeit (Pausenkorrektur)
    // =========================================================================

    /**
     * Event in der 65. Spielminute (50min nach Halbzeit).
     *
     * Echtzeit seit Kick-off: 45min Spiel + 15min Pause + 20min 2.HZ = 80min = 4800s
     * Korrektur: 4800 - 900 = 3900 Spielsekunden
     * positionInVideo = 0 + 3900 = 3900, Offset -60 → 3840
     */
    public function testSecondHalfEventHalftimeBreakIsSubtracted(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/xyz', length: 7200, gameStart: 0);
        // 45min HZ1 + 15min Pause + 20min HZ2 = 4800s Echtzeit
        $event = $this->makeEvent($kickOff, (45 + 15 + 20) * 60);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // eventSeconds = 4800-900=3900, positionInVideo=3900, Offset -60 → 3840
        $this->assertSame(['https://youtu.be/xyz&t=3840s'], $links[1][1]);
    }

    /**
     * Wiederanpfiff: 1s nach Halbzeit-Start.
     * Echtzeit: 2700 + 900 + 1 = 3601s → eventSeconds = 3601-900 = 2701.
     */
    public function testSecondHalfKickOffEvent(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/xyz', length: 7200, gameStart: 0);
        $event = $this->makeEvent($kickOff, 2700 + 900 + 1);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // eventSeconds=2701, Offset -60 → 2641
        $this->assertSame(['https://youtu.be/xyz&t=2641s'], $links[1][1]);
    }

    /**
     * 2. Halbzeit mit Nachspielzeit in der 1. Halbzeit.
     *
     * halfDuration=45, firstHalfExtraTime=3 → firstHalfEndSeconds=2880
     * Echtzeit: 2880 + 900 + 600 = 4380s → eventSeconds = 4380-900 = 3480 (58. Spielminute)
     */
    public function testSecondHalfAfterFirstHalfExtraTime(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/xyz',
            length: 7200,
            gameStart: 0,
            halfDuration: 45,
            firstHalfExtraTime: 3,
        );
        $event = $this->makeEvent($kickOff, 2880 + 900 + 600);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // eventSeconds=3480, Offset -60 → 3420
        $this->assertSame(['https://youtu.be/xyz&t=3420s'], $links[1][1]);
    }

    /**
     * Jugend: halfDuration=35, halftimeBreakDuration=10.
     * Erste Halbzeit: 35*60=2100s
     * Event 5min nach Pause: Echtzeit 35+10+5=50min=3000s → eventSeconds=3000-600=2400.
     */
    public function testYouthGameShorterHalfAndBreak(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/youth',
            length: 6000,
            gameStart: 0,
            halfDuration: 35,
            halftimeBreakDuration: 10,
        );
        $event = $this->makeEvent($kickOff, (35 + 10 + 5) * 60);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // eventSeconds=2400, Offset -60 → 2340
        $this->assertSame(['https://youtu.be/youth&t=2340s'], $links[1][1]);
    }

    // =========================================================================
    // prepareYoutubeLinks – Nachspielzeit & veränderte Halbspielzeiten
    // =========================================================================

    /**
     * NS 2. Halbzeit: Event in der 92. Minute (2min NS) bekommt trotzdem die Pausenkorrektur,
     * weil secondHalfExtraTime die firstHalfEndSeconds-Grenze nicht verschiebt.
     *
     * halfDuration=45, secondHalfExtraTime=4 → firstHalfEndSeconds bleibt 2700
     * Echtzeit: (45+15+45+2)*60 = 107*60 = 6420s
     * eventSeconds = 6420-900 = 5520, positionInVideo = 5520, Offset-60 → 5460
     */
    public function testSecondHalfExtraTimeEventGetsBreakCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 7200,
            gameStart: 0,
        );
        // Echtzeit: 45min HZ1 + 15min Pause + 45min HZ2 + 2min NS = 107min
        $event = $this->makeEvent($kickOff, (45 + 15 + 45 + 2) * 60);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // eventSeconds=5520, Offset -60 → 5460
        $this->assertSame(['https://youtu.be/abc&t=5460s'], $links[1][1]);
    }

    /**
     * NS 2. Halbzeit: Event landet noch im Video (genügend Länge vorhanden).
     * Wenn secondHalfExtraTime fälschlicherweise die Grenze verschieben würde,
     * würde das Event OHNE Pausenkorrektur bei 6420s landen → wäre außerhalb des 7200s-Videos.
     * Korrekt (mit Korrektur) ist 5520s → liegt drin.
     */
    public function testSecondHalfExtraTimeEventIsWithinVideoRange(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 7200,
            gameStart: 0,
        );
        $event = $this->makeEvent($kickOff, (45 + 15 + 45 + 2) * 60); // 92. Minute

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // Muss einen Link liefern (wäre leer wenn Korrektur fehlt und Offset außerhalb)
        $this->assertNotEmpty($links);
        $this->assertNotEmpty($links[1][1]);
    }

    /**
     * Halbzeit 30min (z.B. Halfeld-Cup): halfDuration=30, break=10.
     * firstHalfEndSeconds=1800.
     *
     * Event in der 15. Minute (1. HZ): ≤ 1800 → keine Korrektur
     * positionInVideo = 0+900=900, Offset-60 → 840
     */
    public function testHalfDuration30MinFirstHalfEvent(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/halfeld',
            length: 4200,
            gameStart: 0,
            halfDuration: 30,
            halftimeBreakDuration: 10,
        );
        $event = $this->makeEvent($kickOff, 15 * 60); // 15. Minute

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // positionInVideo=900, Offset-60 → 840
        $this->assertSame(['https://youtu.be/halfeld&t=840s'], $links[1][1]);
    }

    /**
     * Halbzeit 30min, 2. HZ: Event in der 35. Spielminute (5min nach Wiederbeginn).
     *
     * Echtzeit: 1800 + 600 + 300 = 2700s
     * eventSeconds = 2700-600 = 2100, positionInVideo = 2100, Offset-60 → 2040
     */
    public function testHalfDuration30MinSecondHalfEvent(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/halfeld',
            length: 4200,
            gameStart: 0,
            halfDuration: 30,
            halftimeBreakDuration: 10,
        );
        // Echtzeit: 30min HZ1 + 10min Pause + 5min HZ2
        $event = $this->makeEvent($kickOff, (30 + 10 + 5) * 60);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        // eventSeconds=2100, positionInVideo=2100, Offset-60 → 2040
        $this->assertSame(['https://youtu.be/halfeld&t=2040s'], $links[1][1]);
    }

    /**
     * Beide Hälften mit Nachspielzeit: firstHalfExtraTime=3, secondHalfExtraTime=5.
     * firstHalfEndSeconds = (45+3)*60 = 2880.
     *
     * Event A: 47. Minute (1. HZ-Nachspielzeit) → Echtzeit=2820s ≤ 2880 → keine Korrektur
     * positionInVideo = 0+2820=2820, Offset-60 → 2760
     */
    public function testBothExtraTimesFirstHalfExtraTimeEventNoPauseCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 7200,
            gameStart: 0,
            halfDuration: 45,
            firstHalfExtraTime: 3,
        );
        $event = $this->makeEvent($kickOff, 47 * 60); // 47. Minute (Echtzeit 2820s ≤ 2880)

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=2760s'], $links[1][1]);
    }

    /**
     * Beide Hälften mit Nachspielzeit: Event in der 2. HZ (50. Spielminute).
     *
     * firstHalfEndSeconds=2880 | break=15min (900s)
     * Echtzeit: 2880 + 900 + 5*60 = 4080s → eventSeconds = 4080-900 = 3180
     * positionInVideo = 0+3180=3180, Offset-60 → 3120
     */
    public function testBothExtraTimesSecondHalfEventGetsCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 7200,
            gameStart: 0,
            halfDuration: 45,
            firstHalfExtraTime: 3,
        );
        // Echtzeit: 48min NS1-Ende + 15min Pause + 5min HZ2
        $event = $this->makeEvent($kickOff, 2880 + 900 + 5 * 60);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=3120s'], $links[1][1]);
    }

    /**
     * Beide Hälften mit Nachspielzeit: Event in der 2. HZ-Nachspielzeit (3min NS).
     *
     * secondHalfExtraTime=5 verschiebt die firstHalfEndSeconds-Grenze NICHT.
     * firstHalfEndSeconds=2880, break=900s
     * Echtzeit: 2880 + 900 + 2700 + 3*60 = 6660s → eventSeconds = 6660-900 = 5760
     * positionInVideo = 0+5760=5760, Offset-60 → 5700
     */
    public function testBothExtraTimesSecondHalfExtraTimeEventGetsCorrection(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 7200,
            gameStart: 0,
            halfDuration: 45,
            firstHalfExtraTime: 3,
            // secondHalfExtraTime wird im Mock nicht separat übergeben, ändert aber
            // firstHalfTotalSeconds nicht – dieser Test dokumentiert genau das.
        );
        // Echtzeit: NS1-Ende(2880) + Pause(900) + normale HZ2(2700) + 3min NS2
        $event = $this->makeEvent($kickOff, 2880 + 900 + 2700 + 3 * 60);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=5700s'], $links[1][1]);
    }

    /**
     * Grenzfall: Das letzte Event der 1. HZ-Nachspielzeit (genau letzte Sekunde).
     * firstHalfExtraTime=5 → firstHalfEndSeconds=3000
     * Echtzeit=3000s → = firstHalfEndSeconds → keine Korrektur
     * positionInVideo = 0+3000=3000, Offset-60 → 2940.
     */
    public function testEventAtExactEndOfFirstHalfExtraTimeBoundary(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff(
            'https://youtu.be/abc',
            length: 7200,
            gameStart: 0,
            halfDuration: 45,
            firstHalfExtraTime: 5,
        );
        $event = $this->makeEvent($kickOff, (45 + 5) * 60); // genau 3000s

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=2940s'], $links[1][1]);
    }

    /**
     * Erster Event der 2. HZ-Nachspielzeit vs. letztes Event der regulären 2. HZ
     * landen beide im selben Video, mit Pausenkorrektur, in aufsteigender Reihenfolge.
     *
     * halfDuration=45, break=15
     * Letztes reguläres Event (90. Minute): Echtzeit=2700+900+2700=6300s → 6300-900=5400 → pos=5340
     * Erstes NS2-Event (91. Minute):         Echtzeit=6300+60=6360s       → 6360-900=5460 → pos=5400
     */
    public function testRegularEndAndExtraTimeEventsAreOrderedCorrectly(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video = self::createVideo(1, $camera, 1, 7200, 0, 'https://youtu.be/abc');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video]);

        $eventRegular = $this->makeEvent($kickOff, (45 + 15 + 45) * 60, id: 1); // 90. Min Echtzeit
        $eventExtra = $this->makeEvent($kickOff, (45 + 15 + 45 + 1) * 60, id: 2); // 91. Min

        $links = $this->service->prepareYoutubeLinks($game, [$eventRegular, $eventExtra]);

        $this->assertSame(['https://youtu.be/abc&t=5340s'], $links[1][1]);
        $this->assertSame(['https://youtu.be/abc&t=5400s'], $links[2][1]);
        // NS2-Link muss größer sein als reguläres Ende
        $this->assertGreaterThan(5340, 5400);
    }

    // =========================================================================
    // prepareYoutubeLinks – gameStart und Offset-Verhalten
    // =========================================================================

    /**
     * gameStart=30: Kick-off-Event bei Spielsekunde 0 landet bei Position 30s im Video.
     * Mit Offset -60: max(0, 30-60) = 0 (geclampt).
     */
    public function testGameStartOffsetAtKickOff(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 30);
        $event = $this->makeEvent($kickOff, 0);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=0s'], $links[1][1]);
    }

    /**
     * Event bei 30s, Offset=-60: 30-60=-30 → geclampt auf 0.
     */
    public function testOffsetClampedToZero(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 0);
        $event = $this->makeEvent($kickOff, 30);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=0s'], $links[1][1]);
    }

    /**
     * Kein Offset (offset=0): Link zeigt exakt auf die Event-Position.
     */
    public function testZeroOffsetProducesExactPosition(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 0);
        $service = new VideoTimelineService($this->security, 0);
        $event = $this->makeEvent($kickOff, 600);

        $links = $service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=600s'], $links[1][1]);
    }

    /**
     * Positiver Offset: Link springt NACH dem Event.
     */
    public function testPositiveOffsetMovesForward(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 0);
        $service = new VideoTimelineService($this->security, 30);
        $event = $this->makeEvent($kickOff, 600);

        $links = $service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=630s'], $links[1][1]);
    }

    // =========================================================================
    // prepareYoutubeLinks – mehrteilige Aufnahme (mehrere Videos pro Kamera)
    // =========================================================================

    /**
     * Aufnahme in 2 Teilen (z.B. wegen Speicher-Limit).
     *
     * Video 1 (sort=1): gameStart=30, length=2000 → deckt Spielzeit [0, 1970) ab
     * Video 2 (sort=2): gameStart=0,  length=2000 → deckt Spielzeit [1970, 3970) ab
     *
     * Event bei 2200s → im 2. Video:
     *   secondsInto = 2200-1970 = 230, positionInVideo = 0+230 = 230, Offset-60 → 170
     */
    public function testMultiPartEventInSecondVideo(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video1 = self::createVideo(1, $camera, 1, 2000, 30, 'https://youtu.be/part1');
        $video2 = self::createVideo(2, $camera, 2, 2000, 0, 'https://youtu.be/part2');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video1, $video2]);
        $event = $this->makeEvent($kickOff, 2200);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/part2&t=170s'], $links[1][1]);
    }

    /**
     * Event bei 500s liegt im 1. Video ([0, 1970)).
     * positionInVideo = 30 + 500 = 530, Offset -60 → 470.
     */
    public function testMultiPartEventInFirstVideo(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video1 = self::createVideo(1, $camera, 1, 2000, 30, 'https://youtu.be/part1');
        $video2 = self::createVideo(2, $camera, 2, 2000, 0, 'https://youtu.be/part2');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video1, $video2]);
        $event = $this->makeEvent($kickOff, 500);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/part1&t=470s'], $links[1][1]);
    }

    /**
     * Videos werden falsch übergeben (sort=2 vor sort=1), müssen aber trotzdem korrekt gereiht werden.
     */
    public function testMultiPartRespectsSortOrder(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video2 = self::createVideo(2, $camera, 2, 2000, 0, 'https://youtu.be/part2'); // sort=2
        $video1 = self::createVideo(1, $camera, 1, 2000, 30, 'https://youtu.be/part1'); // sort=1
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video2, $video1]); // absichtlich falsch
        $event = $this->makeEvent($kickOff, 2200); // muss in part2 landen

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/part2&t=170s'], $links[1][1]);
    }

    /**
     * Kombiniert: 2. Halbzeit + mehrteilige Aufnahme.
     *
     * Video 1 (sort=1): gameStart=30, length=2800 → deckt Spielzeit [0, 2770) ab
     * Video 2 (sort=2): gameStart=0,  length=2000 → deckt Spielzeit [2770, 4770) ab
     *
     * Event in 2. HZ: Echtzeit = 2700+900+500 = 4100s
     * eventSeconds nach Korrektur = 4100-900 = 3200
     * 3200 liegt in Video 2: secondsInto = 3200-2770 = 430, positionInVideo = 430, Offset-60 → 370
     */
    public function testSecondHalfEventInSecondPartVideoWithBreakCorrection(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video1 = self::createVideo(1, $camera, 1, 2800, 30, 'https://youtu.be/part1');
        $video2 = self::createVideo(2, $camera, 2, 2000, 0, 'https://youtu.be/part2');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video1, $video2]);
        $event = $this->makeEvent($kickOff, 2700 + 900 + 500); // Echtzeit

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/part2&t=370s'], $links[1][1]);
    }

    // =========================================================================
    // prepareYoutubeLinks – mehrere Kameras
    // =========================================================================

    /**
     * Zwei Kameras → dasselbe Event erzeugt Links für beide.
     */
    public function testMultipleCamerasProduceLinksForEach(): void
    {
        $cam1 = self::createCamera(1, 'Cam1');
        $cam2 = self::createCamera(2, 'Cam2');
        $video1 = self::createVideo(1, $cam1, 1, 7200, 0, 'https://youtu.be/cam1');
        $video2 = self::createVideo(2, $cam2, 1, 7200, 0, 'https://youtu.be/cam2');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video1, $video2]);
        $event = $this->makeEvent($kickOff, 600);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertArrayHasKey(1, $links[1]);
        $this->assertArrayHasKey(2, $links[1]);
        $this->assertSame(['https://youtu.be/cam1&t=540s'], $links[1][1]);
        $this->assertSame(['https://youtu.be/cam2&t=540s'], $links[1][2]);
    }

    // =========================================================================
    // prepareYoutubeLinks – Berechtigungen
    // =========================================================================

    /**
     * Keine VIEW-Berechtigung → Video wird übersprungen.
     */
    public function testNoViewPermissionSkipsVideo(): void
    {
        $this->security = $this->createMock(Security::class);
        $this->security->method('isGranted')
            ->with(VideoVoter::VIEW, $this->anything())
            ->willReturn(false);
        $this->service = new VideoTimelineService($this->security, -60);

        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 0);
        $event = $this->makeEvent($kickOff, 600);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertEmpty($links);
    }

    /**
     * Erstes Video ohne Berechtigung, zweites mit:
     * accumulatedGameTime muss trotzdem korrekt hochgezählt werden.
     *
     * Video 1 (sort=1, kein Zugriff): length=2000, gameStart=0 → 2000s Spielzeit
     * Video 2 (sort=2, Zugriff):      length=2000, gameStart=0 → deckt [2000, 4000)
     *
     * Event bei 2200s → in Video 2: secondsInto=200, positionInVideo=200, Offset-60 → 140
     */
    public function testNoPermissionOnFirstVideoAccumulatesGameTimeCorrectly(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video1 = self::createVideo(1, $camera, 1, 2000, 0, 'https://youtu.be/part1');
        $video2 = self::createVideo(2, $camera, 2, 2000, 0, 'https://youtu.be/part2');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video1, $video2]);

        $this->security = $this->createMock(Security::class);
        $this->security->method('isGranted')
            ->willReturnCallback(fn ($attr, $v) => $v === $video2);
        $this->service = new VideoTimelineService($this->security, -60);

        $event = $this->makeEvent($kickOff, 2200);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/part2&t=140s'], $links[1][1]);
    }

    // =========================================================================
    // prepareYoutubeLinks – Randfälle
    // =========================================================================

    /**
     * Event nach Ende aller Videos → kein Link.
     */
    public function testEventAfterLastVideoProducesNoLink(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 1800, gameStart: 0);
        $event = $this->makeEvent($kickOff, 2000); // nach Video-Ende

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertEmpty($links);
    }

    /**
     * Keine Videos → leeres Ergebnis.
     */
    public function testNoVideosProducesEmptyResult(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([]);
        $event = $this->makeEvent($kickOff, 600);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertEmpty($links);
    }

    /**
     * Keine Events → leeres Ergebnis.
     */
    public function testNoEventsProducesEmptyResult(): void
    {
        [$game] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 0);

        $links = $this->service->prepareYoutubeLinks($game, []);

        $this->assertEmpty($links);
    }

    /**
     * Mehrere Events erzeugen separate Einträge per ID.
     */
    public function testMultipleEventsProduceSeparateEntriesByEventId(): void
    {
        $camera = self::createCamera(1, 'Cam');
        $video = self::createVideo(1, $camera, 1, 7200, 0, 'https://youtu.be/abc');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video]);

        $event1 = $this->makeEvent($kickOff, 600, id: 10);
        $event2 = $this->makeEvent($kickOff, 1800, id: 20);

        $links = $this->service->prepareYoutubeLinks($game, [$event1, $event2]);

        $this->assertArrayHasKey(10, $links);
        $this->assertArrayHasKey(20, $links);
        $this->assertSame(['https://youtu.be/abc&t=540s'], $links[10][1]);
        $this->assertSame(['https://youtu.be/abc&t=1740s'], $links[20][1]);
    }

    // =========================================================================
    // orderVideos – DataProvider-Tests (Layout und Sortierung)
    // =========================================================================

    /**
     * @param Video[]                       $videoEntries
     * @param array<int, array<int, Video>> $expectedVideos
     */
    #[DataProvider('orderVideosProvider')]
    public function testOrderVideos(array $videoEntries, array $expectedVideos): void
    {
        $game = $this->createMock(Game::class);
        $game->method('getVideos')->willReturn(new ArrayCollection($videoEntries));

        $result = $this->service->orderVideos($game);

        foreach ($expectedVideos as $cameraId => $expectedCameraVideos) {
            $this->assertArrayHasKey($cameraId, $result, "Camera $cameraId should be present in result");

            foreach ($expectedCameraVideos as $startTime => $video) {
                $this->assertArrayHasKey($startTime, $result[$cameraId], "Start time $startTime should be present for camera $cameraId");
                $this->assertSame($video, $result[$cameraId][$startTime], "Video at start time $startTime for camera $cameraId should match");
            }
        }
    }

    public static function orderVideosProvider(): Generator
    {
        // Szenario 1: Eine Kamera, zwei Videos mit gameStart
        $camera1 = self::createCamera(1, 'DJI Osmo Action 5');
        $video1 = self::createVideo(1, $camera1, 1, 1550, 359);
        $video2 = self::createVideo(2, $camera1, 2, 1556, null);

        yield 'single_camera_two_videos_with_gameStart' => [
            [$video1, $video2],
            [1 => [0 => $video1, 1550 => $video2]],
        ];

        // Szenario 2: Mehrere Kameras
        $camera2 = self::createCamera(2, 'GoPro Hero 11');
        $video3 = self::createVideo(3, $camera2, 1, 2700, 900);
        $video4 = self::createVideo(4, $camera1, 3, 186, null);

        yield 'multiple_cameras_different_timings' => [
            [$video1, $video2, $video3, $video4],
            [
                1 => [0 => $video1, 1550 => $video2, 3106 => $video4],
                2 => [0 => $video3],
            ],
        ];

        // Szenario 3: Volles Spiel (6 Videos)
        $video5 = self::createVideo(11, $camera1, 1, 1550, 359);
        $video6 = self::createVideo(12, $camera1, 2, 1556, null);
        $video7 = self::createVideo(13, $camera1, 3, 186, null);
        $video8 = self::createVideo(14, $camera1, 4, 1560, 133);
        $video9 = self::createVideo(15, $camera1, 5, 1551, null);
        $video10 = self::createVideo(16, $camera1, 6, 346, null);

        yield 'full_game_six_videos' => [
            [$video5, $video6, $video7, $video8, $video9, $video10],
            [
                1 => [
                    0 => $video5,
                    1550 => $video6,
                    3106 => $video7,
                    3292 => $video8,
                    4852 => $video9,
                    6403 => $video10,
                ],
            ],
        ];

        // Szenario 4: Drei Kameras
        $camera3 = self::createCamera(3, 'iPhone 14 Pro');
        $videoA = self::createVideo(20, $camera1, 1, 2700, 300);
        $videoB = self::createVideo(21, $camera2, 1, 2400, 600);
        $videoC = self::createVideo(22, $camera3, 1, 1800, 1200);

        yield 'three_cameras_overlapping' => [
            [$videoA, $videoB, $videoC],
            [
                1 => [0 => $videoA],
                2 => [0 => $videoB],
                3 => [0 => $videoC],
            ],
        ];
    }

    /**
     * Videos ohne Kamera werden in orderVideos übersprungen.
     */
    public function testOrderVideosSkipsVideosWithoutCamera(): void
    {
        $videoNoCamera = new Video();
        $videoNoCamera->setSort(1);
        $videoNoCamera->setLength(1000);
        $videoNoCamera->setName('no-camera');
        $videoNoCamera->setUrl('https://youtu.be/skip');
        // keine Camera gesetzt

        $game = $this->createMock(Game::class);
        $game->method('getVideos')->willReturn(new ArrayCollection([$videoNoCamera]));

        $result = $this->service->orderVideos($game);

        $this->assertEmpty($result);
    }

    /**
     * Kameras werden nach ID aufsteigend sortiert.
     */
    public function testOrderVideosSortsCamerasByIdAscending(): void
    {
        $cam3 = self::createCamera(3, 'Cam3');
        $cam1 = self::createCamera(1, 'Cam1');
        $videoC3 = self::createVideo(1, $cam3, 1, 1000, 0, 'https://youtu.be/cam3');
        $videoC1 = self::createVideo(2, $cam1, 1, 1000, 0, 'https://youtu.be/cam1');

        $game = $this->createMock(Game::class);
        $game->method('getVideos')->willReturn(new ArrayCollection([$videoC3, $videoC1]));

        $result = $this->service->orderVideos($game);

        $this->assertSame([1, 3], array_keys($result)); // ID 1 vor ID 3
    }

    // =========================================================================
    // prepareYoutubeLinks – DataProvider (Reale Szenarien)
    // =========================================================================

    /**
     * @param Video[]                              $videoEntries
     * @param GameEvent[]                          $gameEvents
     * @param array<int, array<int, list<string>>> $expectedLinks
     */
    #[DataProvider('youtubeLinksProvider')]
    public function testPrepareYoutubeLinks(
        array $videoEntries,
        array $gameEvents,
        int $gameStartTimestamp,
        int $firstHalfTotalSeconds,
        int $halftimeBreakDuration,
        array $expectedLinks
    ): void {
        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')
            ->willReturn(new DateTimeImmutable('@' . $gameStartTimestamp));

        $game = $this->createMock(Game::class);
        $game->method('getVideos')->willReturn(new ArrayCollection($videoEntries));
        $game->method('getCalendarEvent')->willReturn($calendarEvent);
        $game->method('getFirstHalfTotalSeconds')->willReturn($firstHalfTotalSeconds);
        $game->method('getHalftimeBreakDuration')->willReturn($halftimeBreakDuration);

        $result = $this->service->prepareYoutubeLinks($game, $gameEvents);

        $this->assertEquals($expectedLinks, $result);
    }

    public static function youtubeLinksProvider(): Generator
    {
        $camera1 = self::createCamera(1, 'DJI Osmo Action 5');
        $gameStartTimestamp = 1731146400; // 2025-11-09 10:00:00

        // ─── Szenario 1: 1. Halbzeit, Events bei 60s / 1740s / 2100s ───────
        // Alle Events < firstHalfTotalSeconds=2700 → keine Pausenkorrektur
        $video1 = self::createVideo(11, $camera1, 1, 1550, 359, 'https://youtu.be/yE4GwJ3zTvE');
        $video2 = self::createVideo(12, $camera1, 2, 1556, null, 'https://youtu.be/-hY82oPu4eU');
        $video3 = self::createVideo(13, $camera1, 3, 186, null, 'https://youtu.be/eOEOiZorjV8');

        $event1 = self::createGameEvent(27, $gameStartTimestamp + 60);   // 10:01
        $event2 = self::createGameEvent(28, $gameStartTimestamp + 1740); // 10:29
        $event3 = self::createGameEvent(29, $gameStartTimestamp + 2100); // 10:35

        // video1: gameTime [0, 1191), gameStart=359
        // event27 (60s): pos=359+60-60=359  → https://youtu.be/yE4GwJ3zTvE&t=359s
        // event28 (1740s): in video2 [1191,2747): secondsInto=549 → pos=0+549-60=489
        // event29 (2100s): in video2 [1191,2747): secondsInto=909 → pos=0+909-60=849
        yield 'real_world_first_half' => [
            [$video1, $video2, $video3],
            [$event1, $event2, $event3],
            $gameStartTimestamp,
            2700, // firstHalfTotalSeconds (kein Extra-Time)
            15,   // halftimeBreakDuration
            [
                27 => [1 => ['https://youtu.be/yE4GwJ3zTvE&t=359s']],
                28 => [1 => ['https://youtu.be/-hY82oPu4eU&t=489s']],
                29 => [1 => ['https://youtu.be/-hY82oPu4eU&t=849s']],
            ],
        ];

        // ─── Szenario 2: 2. Halbzeit mit Pausenkorrektur ────────────────────
        // Events bei Echtzeit 3480s und 4260s (> firstHalfTotalSeconds=2700)
        // Korrektur: -900s (15min Pause)
        // eventSeconds: 2580s bzw. 3360s
        $video4 = self::createVideo(14, $camera1, 4, 1560, 133, 'https://youtu.be/OLnoG-Og6sI');
        $video5 = self::createVideo(15, $camera1, 5, 1551, null, 'https://youtu.be/lIhsIl7SDWw');

        $event4 = self::createGameEvent(31, $gameStartTimestamp + 3480); // Echtzeit 58min
        $event5 = self::createGameEvent(32, $gameStartTimestamp + 4260); // Echtzeit 71min

        // Alle 5 Videos (sort 1–5): gameTime-Ranges
        // [0,1191), [1191,2747), [2747,2933), [2933,4360), [4360,5911)
        // event31: eventSeconds=2580 → in video2 [1191,2747): secondsInto=1389 → pos=0+1389-60=1329
        // event32: eventSeconds=3360 → in video4 [2933,4360): secondsInto=427 → pos=133+427-60=500
        yield 'real_world_second_half_with_break_correction' => [
            [$video1, $video2, $video3, $video4, $video5],
            [$event4, $event5],
            $gameStartTimestamp,
            2700, // firstHalfTotalSeconds
            15,   // halftimeBreakDuration
            [
                31 => [1 => ['https://youtu.be/-hY82oPu4eU&t=1329s']],
                32 => [1 => ['https://youtu.be/OLnoG-Og6sI&t=500s']],
            ],
        ];

        // ─── Szenario 3: Mehrere Kameras, gleiches Event ─────────────────────
        $camera2 = self::createCamera(2, 'GoPro');
        $videoA1 = self::createVideo(30, $camera1, 1, 2700, 300, 'https://youtu.be/cam1vid1');
        $videoA2 = self::createVideo(31, $camera2, 1, 2700, 300, 'https://youtu.be/cam2vid1');
        $event6 = self::createGameEvent(40, $gameStartTimestamp + 1200); // 20min, 1. HZ

        // Kein Pause-Abzug (1200 < 2700), beide Kameras: gameStart=300, pos=300+1200-60=1440
        yield 'multiple_cameras_same_event' => [
            [$videoA1, $videoA2],
            [$event6],
            $gameStartTimestamp,
            2700,
            15,
            [
                40 => [
                    1 => ['https://youtu.be/cam1vid1&t=1440s'],
                    2 => ['https://youtu.be/cam2vid1&t=1440s'],
                ],
            ],
        ];

        // ─── Szenario 4: Event außerhalb aller Videos ────────────────────────
        $videoB1 = self::createVideo(50, $camera1, 1, 1000, 300, 'https://youtu.be/short');
        $event7 = self::createGameEvent(50, $gameStartTimestamp + 900); // 15min, deckt nur [0,700)

        yield 'event_outside_video_coverage' => [
            [$videoB1],
            [$event7],
            $gameStartTimestamp,
            2700,
            15,
            [],
        ];

        // ─── Szenario 5: Mehrere Events im selben Video ──────────────────────
        $videoF1 = self::createVideo(90, $camera1, 1, 3000, 300, 'https://youtu.be/multipleevents');
        $event12 = self::createGameEvent(90, $gameStartTimestamp + 600);
        $event13 = self::createGameEvent(91, $gameStartTimestamp + 1200);
        $event14 = self::createGameEvent(92, $gameStartTimestamp + 1800);

        yield 'multiple_events_same_video' => [
            [$videoF1],
            [$event12, $event13, $event14],
            $gameStartTimestamp,
            2700,
            15,
            [
                90 => [1 => ['https://youtu.be/multipleevents&t=840s']],  // 300+600-60=840
                91 => [1 => ['https://youtu.be/multipleevents&t=1440s']], // 300+1200-60=1440
                92 => [1 => ['https://youtu.be/multipleevents&t=2040s']], // 300+1800-60=2040
            ],
        ];

        // ─── Szenario 6: Jugend (halfDuration=35, break=10) ──────────────────
        $cameraJ = self::createCamera(1, 'Jugend-Cam');
        $videoJ = self::createVideo(100, $cameraJ, 1, 7200, 0, 'https://youtu.be/youth');
        // Event 5min in die 2. HZ: Echtzeit = 35*60 + 10*60 + 5*60 = 3000s
        $eventJ = self::createGameEvent(100, $gameStartTimestamp + 3000);

        yield 'youth_game_second_half_break_correction' => [
            [$videoJ],
            [$eventJ],
            $gameStartTimestamp,
            2100, // 35*60, firstHalfTotalSeconds
            10,   // halftimeBreakDuration
            [
                100 => [1 => ['https://youtu.be/youth&t=2340s']], // 3000-600=2400, Offset-60=2340
            ],
        ];

        // ─── Szenario 7: 2. HZ-Nachspielzeit (secondHalfExtraTime=4) ─────────
        // firstHalfEndSeconds=2700 (unverändert), break=15
        // Event in 92. Minute: Echtzeit=(45+15+45+2)*60=6420s → 6420-900=5520
        // positionInVideo=5520, Offset-60=5460
        $cameraS = self::createCamera(1, 'StopTime-Cam');
        $videoS = self::createVideo(200, $cameraS, 1, 7200, 0, 'https://youtu.be/stoppage');
        $eventS = self::createGameEvent(200, $gameStartTimestamp + (45 + 15 + 45 + 2) * 60);

        yield 'second_half_extra_time_event' => [
            [$videoS],
            [$eventS],
            $gameStartTimestamp,
            2700, // secondHalfExtraTime ändert boundary NICHT
            15,
            [
                200 => [1 => ['https://youtu.be/stoppage&t=5460s']],
            ],
        ];

        // ─── Szenario 8: Halfeld-Cup (halfDuration=30, break=10) ─────────────
        // firstHalfEndSeconds=1800, breakSeconds=600
        // Event 1: 15. Minute (HZ1) → Echtzeit=900s ≤ 1800 → keine Korrektur, pos=900-60=840
        // Event 2: 35. Minute (5min HZ2) → Echtzeit=1800+600+300=2700s → 2700-600=2100, pos=2100-60=2040
        $cameraH = self::createCamera(1, 'Halfeld-Cam');
        $videoH = self::createVideo(210, $cameraH, 1, 4200, 0, 'https://youtu.be/halfeld');
        $eventH1 = self::createGameEvent(210, $gameStartTimestamp + 15 * 60);
        $eventH2 = self::createGameEvent(211, $gameStartTimestamp + (30 + 10 + 5) * 60);

        yield 'thirty_min_halves_both_halves' => [
            [$videoH],
            [$eventH1, $eventH2],
            $gameStartTimestamp,
            1800, // 30*60
            10,
            [
                210 => [1 => ['https://youtu.be/halfeld&t=840s']],
                211 => [1 => ['https://youtu.be/halfeld&t=2040s']],
            ],
        ];

        // ─── Szenario 9: Beide Hälften mit Nachspielzeit ─────────────────────
        // halfDuration=45, firstHalfExtraTime=3, secondHalfExtraTime=5
        // firstHalfEndSeconds=(45+3)*60=2880, break=15 (900s)
        //
        // Event A: 47. Minute (1. HZ-NS, Echtzeit=2820s ≤ 2880) → keine Korrektur
        //   positionInVideo = 0+2820=2820, Offset-60=2760
        // Event B: 50. Minute (5min HZ2, Echtzeit=2880+900+300=4080s > 2880) → -900
        //   positionInVideo = 0+(4080-900)=3180, Offset-60=3120
        // Event C: 93. Minute (3min HZ2-NS, Echtzeit=2880+900+2700+180=6660s > 2880) → -900
        //   positionInVideo = 0+(6660-900)=5760, Offset-60=5700
        $cameraB = self::createCamera(1, 'BothET-Cam');
        $videoB = self::createVideo(220, $cameraB, 1, 7200, 0, 'https://youtu.be/bothet');
        $eventB1 = self::createGameEvent(220, $gameStartTimestamp + 47 * 60);
        $eventB2 = self::createGameEvent(221, $gameStartTimestamp + 2880 + 900 + 5 * 60);
        $eventB3 = self::createGameEvent(222, $gameStartTimestamp + 2880 + 900 + 2700 + 3 * 60);

        yield 'both_halves_extra_time_all_three_zones' => [
            [$videoB],
            [$eventB1, $eventB2, $eventB3],
            $gameStartTimestamp,
            2880, // (45+3)*60 – secondHalfExtraTime ignoriert
            15,
            [
                220 => [1 => ['https://youtu.be/bothet&t=2760s']],
                221 => [1 => ['https://youtu.be/bothet&t=3120s']],
                222 => [1 => ['https://youtu.be/bothet&t=5700s']],
            ],
        ];

        // ─── Szenario 10: NS1-Boundary-Grenzfall ─────────────────────────────
        // firstHalfExtraTime=5 → firstHalfEndSeconds=3000
        // Event genau bei Echtzeit=3000s → = boundary → KEINE Korrektur
        // positionInVideo=3000, Offset-60=2940
        // Nächstes Event bei 3001s → > boundary → Korrektur -900 → 3001-900=2101, pos=2101-60=2041
        $cameraX = self::createCamera(1, 'Boundary-Cam');
        $videoX = self::createVideo(230, $cameraX, 1, 7200, 0, 'https://youtu.be/boundary');
        $eventX1 = self::createGameEvent(230, $gameStartTimestamp + (45 + 5) * 60); // exakt 3000s
        $eventX2 = self::createGameEvent(231, $gameStartTimestamp + (45 + 5) * 60 + 1); // 3001s

        yield 'first_half_extra_time_exact_boundary' => [
            [$videoX],
            [$eventX1, $eventX2],
            $gameStartTimestamp,
            3000, // (45+5)*60
            15,
            [
                230 => [1 => ['https://youtu.be/boundary&t=2940s']], // 3000-60=2940 (keine Korrektur)
                231 => [1 => ['https://youtu.be/boundary&t=2041s']], // 3001-900=2101, 2101-60=2041
            ],
        ];
    }

    // =========================================================================
    // setYoutubeLinkStartOffset
    // =========================================================================

    public function testSetYoutubeLinkStartOffsetChangesSubsequentLinks(): void
    {
        [$game, $kickOff] = $this->makeGameWithKickOff('https://youtu.be/abc', length: 3600, gameStart: 0);
        $this->service->setYoutubeLinkStartOffset(0);
        $event = $this->makeEvent($kickOff, 600);

        $links = $this->service->prepareYoutubeLinks($game, [$event]);

        $this->assertSame(['https://youtu.be/abc&t=600s'], $links[1][1]);
    }

    // =========================================================================
    // Diverse Offset-Werte
    // =========================================================================

    #[DataProvider('offsetProvider')]
    public function testDifferentOffsets(int $offset, int $expectedSeconds): void
    {
        $service = new VideoTimelineService($this->security, $offset);
        $camera = self::createCamera(1, 'Test Camera');
        $video = self::createVideo(1, $camera, 1, 1800, 300, 'https://youtu.be/test');
        [$game, $kickOff] = $this->makeGameWithKickOffAndVideos([$video]);
        $event = $this->makeEvent($kickOff, 600); // 600s Spielzeit, liegt in [0, 1500)

        $links = $service->prepareYoutubeLinks($game, [$event]);

        $this->assertStringContainsString("&t={$expectedSeconds}s", $links[1][1][0]);
    }

    public static function offsetProvider(): Generator
    {
        // gameStart=300, eventSeconds=600 → positionInVideo=300+600=900
        yield 'offset_minus_60' => [-60, 840];  // 900-60=840
        yield 'offset_minus_30' => [-30, 870];  // 900-30=870
        yield 'offset_0' => [0,   900];  // 900-0=900
        yield 'offset_plus_10' => [10,  910];  // 900+10=910
    }

    // =========================================================================
    // Helper-Methoden
    // =========================================================================

    /**
     * Erstellt ein Game-Mock mit einer Kamera, einem Video und einem Kick-off.
     *
     * @return array{0: Game, 1: DateTimeImmutable}
     */
    private function makeGameWithKickOff(
        string $url,
        int $length,
        ?int $gameStart,
        int $halfDuration = 45,
        ?int $firstHalfExtraTime = null,
        int $halftimeBreakDuration = 15,
    ): array {
        $kickOff = new DateTimeImmutable('2025-04-01 15:00:00');
        $camera = self::createCamera(1, 'TestCam');
        $video = self::createVideo(1, $camera, 1, $length, $gameStart, $url);

        return [$this->makeGameWithKickOffAndVideos([$video], $kickOff, $halfDuration, $firstHalfExtraTime, $halftimeBreakDuration)[0], $kickOff];
    }

    /**
     * @param Video[] $videos
     *
     * @return array{0: Game, 1: DateTimeImmutable}
     */
    private function makeGameWithKickOffAndVideos(
        array $videos,
        ?DateTimeImmutable $kickOff = null,
        int $halfDuration = 45,
        ?int $firstHalfExtraTime = null,
        int $halftimeBreakDuration = 15,
    ): array {
        $kickOff ??= new DateTimeImmutable('2025-04-01 15:00:00');

        $calendarEvent = $this->createMock(CalendarEvent::class);
        $calendarEvent->method('getStartDate')->willReturn($kickOff);

        $game = $this->createMock(Game::class);
        $game->method('getCalendarEvent')->willReturn($calendarEvent);
        $game->method('getVideos')->willReturn(new ArrayCollection($videos));
        $game->method('getFirstHalfTotalSeconds')
            ->willReturn(($halfDuration + ($firstHalfExtraTime ?? 0)) * 60);
        $game->method('getHalftimeBreakDuration')->willReturn($halftimeBreakDuration);

        return [$game, $kickOff];
    }

    /**
     * Event bei $kickOff + $offsetSeconds.
     */
    private function makeEvent(DateTimeImmutable $kickOff, int $offsetSeconds, int $id = 1): GameEvent
    {
        $event = $this->createMock(GameEvent::class);
        $event->method('getTimestamp')->willReturn($kickOff->modify('+' . $offsetSeconds . ' seconds'));
        $event->method('getId')->willReturn($id);

        return $event;
    }

    private static function createCamera(int $id, string $name): Camera
    {
        $camera = new Camera();
        $reflection = new ReflectionClass($camera);
        $idProp = $reflection->getProperty('id');
        $idProp->setAccessible(true);
        $idProp->setValue($camera, $id);
        $camera->setName($name);

        return $camera;
    }

    private static function createVideo(
        int $id,
        Camera $camera,
        int $sort,
        int $length,
        ?int $gameStart,
        string $url = 'https://youtu.be/test',
    ): Video {
        $video = new Video();
        $reflection = new ReflectionClass($video);
        $idProp = $reflection->getProperty('id');
        $idProp->setAccessible(true);
        $idProp->setValue($video, $id);

        $video->setCamera($camera);
        $video->setSort($sort);
        $video->setLength($length);
        $video->setGameStart($gameStart);
        $video->setUrl($url);
        $video->setName('Test');

        return $video;
    }

    private static function createGameEvent(int $id, int $timestamp): GameEvent
    {
        $event = new GameEvent();
        $reflection = new ReflectionClass($event);
        $idProp = $reflection->getProperty('id');
        $idProp->setAccessible(true);
        $idProp->setValue($event, $id);
        $event->setTimestamp(new DateTimeImmutable('@' . $timestamp));

        return $event;
    }
}
