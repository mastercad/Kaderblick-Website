<?php

namespace App\Service;

use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\Video;
use App\Security\Voter\VideoVoter;
use Symfony\Bundle\SecurityBundle\Security;

class VideoTimelineService
{
    private int $youtubeLinkStartOffset = -30;

    public function __construct(
        private readonly Security $security,
        int $youtubeLinkStartOffset = -30
    ) {
        $this->youtubeLinkStartOffset = $youtubeLinkStartOffset;
    }

    /**
     * Berechnet YouTube-Links für GameEvents basierend auf Video-Timeline.
     *
     * @param GameEvent[] $gameEvents
     *
     * @return array<int, array<int, list<string>>> YouTube-Links gruppiert nach Event-ID und Kamera-ID
     */
    public function prepareYoutubeLinks(Game $game, array $gameEvents): array
    {
        $youtubeLinks = [];
        $videos = $this->orderVideos($game);

        $startTimestamp = $game->getCalendarEvent()?->getStartDate()?->getTimestamp();

        // Halbzeitpausen-Korrektur:
        // GameEvent-Timestamps sind absolute Echtzeit-Datetimes.
        // Die Video-Timeline hingegen setzt Videos nahtlos hintereinander – sie enthält
        // keine Halbzeitpause. Deshalb muss für Ereignisse in der 2. Halbzeit (und später)
        // die Pausendauer von eventSeconds abgezogen werden, damit der berechnete
        // Video-Zeitpunkt stimmt.
        //        $firstHalfEndSeconds = $game->getFirstHalfTotalSeconds();
        //        $breakSeconds = $game->getHalftimeBreakDuration() * 60;

        foreach ($gameEvents as $event) {
            // Event-Zeit relativ zum Spielstart (in Sekunden, Echtzeit)
            //            $eventSecondsRealTime = ($event->getTimestamp()->getTimestamp() - $startTimestamp);
            $eventSeconds = ($event->getTimestamp()->getTimestamp() - $startTimestamp);

            // Korrektur um Halbzeitpause für Ereignisse nach der 1. Halbzeit
            //            $eventSeconds = $eventSecondsRealTime > $firstHalfEndSeconds
            //                ? $eventSecondsRealTime - $breakSeconds
            //                : $eventSecondsRealTime;

            foreach ($videos as $cameraId => $currentVideos) {
                // Verfolge die akkumulierte Spielzeit über alle Videos dieser Kamera
                $accumulatedGameTime = 0;

                foreach ($currentVideos as $videoTimelineStart => $video) {
                    $gameStart = $video->getGameStart() ?? 0;
                    $videoLength = $video->getLength();

                    // Wie viel Spielzeit deckt dieses Video ab?
                    $gameTimeInThisVideo = $videoLength - $gameStart;

                    // Spielzeit-Bereich, den dieses Video abdeckt
                    $gameTimeStart = $accumulatedGameTime;
                    $gameTimeEnd = $accumulatedGameTime + $gameTimeInThisVideo;

                    // Prüfe ob Event in diesem Video liegt – nur wenn Berechtigung vorhanden
                    if (
                        $this->security->isGranted(VideoVoter::VIEW, $video)
                        && $eventSeconds >= $gameTimeStart && $eventSeconds <= $gameTimeEnd
                    ) {
                        // Wie viele Sekunden nach gameTimeStart ist das Event?
                        $secondsIntoGameTimeOfThisVideo = $eventSeconds - $gameTimeStart;

                        // Position im YouTube-Video = Sekunden ins Video
                        // Bei Videos mit gameStart: Das Video startet bei 0, aber das Spiel beginnt erst bei gameStart
                        // Daher: Wenn Event bei Spielsekunde X liegt und Video bei Spielsekunde Y beginnt,
                        // dann ist Position = gameStart + (X - Y)
                        $positionInVideo = $gameStart + $secondsIntoGameTimeOfThisVideo;

                        // Addiere den Offset und stelle sicher, dass wir nicht negativ werden
                        $seconds = max(0, $positionInVideo + $this->youtubeLinkStartOffset);

                        $youtubeLinks[(int) $event->getId()][(int) $cameraId][] = $video->getUrl() .
                            '&t=' . $seconds . 's';
                    }

                    // Akkumuliere die Spielzeit für das nächste Video
                    $accumulatedGameTime += $gameTimeInThisVideo;
                }
            }
        }

        return $youtubeLinks;
    }

    /**
     * Ordnet Videos nach Kamera und erstellt eine Timeline.
     *
     * @return array<int, array<int, Video>> Videos gruppiert nach Kamera-ID mit Startzeit als Key
     */
    public function orderVideos(Game $game): array
    {
        $videosEntries = $game->getVideos()->toArray();
        $videos = [];
        $cameras = [];

        foreach ($videosEntries as $videoEntry) {
            $camera = $videoEntry->getCamera();
            if (!$camera) {
                continue;
            }
            $cameras[(int) $camera->getId()][(int) $videoEntry->getSort()] = $videoEntry;
        }

        foreach ($cameras as $cameraId => $currentVideos) {
            ksort($currentVideos);
            $cameras[$cameraId] = $currentVideos;
        }

        ksort($cameras);

        foreach ($cameras as $camera => $currentVideos) {
            $currentStart = 0;
            foreach ($currentVideos as $video) {
                $videos[$camera][$currentStart] = $video;
                // Addiere IMMER die volle Videolänge zur Timeline
                $currentStart += $video->getLength();
            }
        }

        return $videos;
    }

    public function setYoutubeLinkStartOffset(int $offset): void
    {
        $this->youtubeLinkStartOffset = $offset;
    }
}
