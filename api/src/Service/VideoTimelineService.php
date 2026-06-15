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

        foreach ($gameEvents as $event) {
            $eventSeconds = ($event->getTimestamp()->getTimestamp() - $startTimestamp);

            foreach ($videos as $cameraId => $currentVideos) {
                $accumulatedGameTime = 0;

                foreach ($currentVideos as $videoTimelineStart => $video) {
                    $gameStart = $video->getGameStart() ?? 0;
                    $videoLength = $video->getLength();

                    $gameTimeInThisVideo = $videoLength - $gameStart;

                    $gameTimeStart = $accumulatedGameTime;
                    $gameTimeEnd = $accumulatedGameTime + $gameTimeInThisVideo;

                    if (
                        $this->security->isGranted(VideoVoter::VIEW, $video)
                        && $eventSeconds >= $gameTimeStart && $eventSeconds <= $gameTimeEnd
                    ) {
                        $secondsIntoGameTimeOfThisVideo = $eventSeconds - $gameTimeStart;
                        $positionInVideo = $gameStart + $secondsIntoGameTimeOfThisVideo;
                        $seconds = max(0, $positionInVideo + $this->youtubeLinkStartOffset);

                        $youtubeLinks[(int) $event->getId()][(int) $cameraId][] = $video->getUrl() .
                            '&t=' . $seconds . 's';
                    }

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
