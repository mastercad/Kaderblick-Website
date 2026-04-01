<?php

namespace App\Controller;

use App\Entity\Camera;
use App\Entity\Game;
use App\Entity\User;
use App\Entity\Video;
use App\Entity\VideoType;
use App\Repository\CameraRepository;
use App\Repository\GameEventRepository;
use App\Repository\GameRepository;
use App\Repository\VideoRepository;
use App\Repository\VideoTypeRepository;
use App\Security\Voter\VideoVoter;
use App\Service\VideoTimelineService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

class VideosController extends AbstractController
{
    public function __construct(
        private readonly VideoTimelineService $videoTimelineService
    ) {
    }

    #[Route('/videos/{gameId}', name: 'videos_list', methods: ['GET'])]
    public function details(
        int $gameId,
        GameEventRepository $gameEventRepository,
        GameRepository $gameRepository,
        VideoTypeRepository $videoTypeRepository,
        CameraRepository $cameraRepository
    ): JsonResponse {
        $game = $gameRepository->find($gameId);
        $gameEvents = $gameEventRepository->findAllGameEvents($game);
        if (!$game) {
            return new JsonResponse(['error' => 'Spiel nicht gefunden'], 404);
        }

        if (!$this->isGranted(VideoVoter::VIEW, $game)) {
            return new JsonResponse(['error' => 'Zugriff verweigert – nur Teammitglieder können Videos einsehen.'], 403);
        }

        $rawVideos = $game->getVideos();
        $videos = [];
        /** @var Video $rawVideo */
        foreach ($rawVideos as $rawVideo) {
            $videos[$rawVideo->getSort()] = $rawVideo;
        }

        ksort($videos);

        $videoTypes = $videoTypeRepository->findAll();
        $cameras = $cameraRepository->findAll();
        $data = [];

        foreach ($videos as $video) {
            $data[] = [
                'id' => $video->getId(),
                'name' => $video->getName(),
                'url' => $video->getUrl(),
                'youtubeId' => $video->getYoutubeId(),
                'filePath' => $video->getFilePath(),
                'gameStart' => $video->getGameStart(),
                'sort' => $video->getSort(),
                'length' => $video->getLength(),
                'videoType' => [
                    'id' => $video->getVideoType()?->getId(),
                    'name' => $video->getVideoType()?->getName(),
                    'sort' => $video->getVideoType()?->getSort()
                ],
                'camera' => [
                    'id' => $video->getCamera()?->getId(),
                    'name' => $video->getCamera()?->getName()
                ],
                'createdAt' => $video->getCreatedAt()?->format('c'),
                'updatedAt' => $video->getUpdatedAt()?->format('c'),
            ];
        }

        return new JsonResponse([
            'videos' => $data,
            'youtubeLinks' => $this->videoTimelineService->prepareYoutubeLinks($game, $gameEvents),
            'videoTypes' => array_map(fn (VideoType $videoType) => [
                'id' => $videoType->getId(),
                'name' => $videoType->getName(),
            ], $videoTypes),
            'cameras' => array_map(fn (Camera $camera) => [
                'id' => $camera->getId(),
                'name' => $camera->getName(),
            ], $cameras)
        ]);
    }

    #[Route('/videos/save/{gameId}', name: 'videos_save', methods: ['POST'])]
    public function save(
        int $gameId,
        Request $request,
        GameRepository $gameRepository,
        VideoRepository $videoRepository,
        VideoTypeRepository $videoTypeRepository,
        CameraRepository $cameraRepository,
        EntityManagerInterface $em
    ): JsonResponse {
        /** @var ?Game $game */
        $game = $gameRepository->find($gameId);
        if (null === $game) {
            return new JsonResponse(['error' => 'Spiel nicht gefunden'], 404);
        }

        // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER oder Trainer dürfen Videos anlegen/bearbeiten
            // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER dürfen Videos anlegen/bearbeiten
        if (!$this->isGranted(VideoVoter::CREATE, $game)) {
            return new JsonResponse(['error' => 'Zugriff verweigert – nur Teammitglieder können Videos verwalten.'], 403);
        }

        /** @var User $user */
        $user = $this->getUser();

        $videoData = json_decode($request->getContent(), true);

        $videoId = $videoData['video_id'] ?? null;
        $name = $videoData['name'] ?? null;
        $url = $videoData['url'] ?? null;
        $filePath = $videoData['filePath'] ?? null;
        $gameStart = $videoData['gameStart'] ?? null;
        $videoTypeId = $videoData['videoType'] ?? null;
        $cameraId = $videoData['camera'] ?? null;
        $videoType = null;
        $sort = $videoData['sort'] ?? null;
        $length = $videoData['length'] ?? null;

        // YouTube-ID extrahieren
        $youtubeId = null;
        if (preg_match('~(?:youtu.be/|youtube.com/(?:embed/|v/|watch\?v=|watch\?.+&v=))([\w-]{11})~i', $url, $matches)) {
            $youtubeId = $matches[1];
        }

        if ($videoTypeId) {
            $videoType = $videoTypeRepository->find($videoTypeId);
        }

        if (!$videoType) {
            return new JsonResponse(['error' => 'VideoType nicht gefunden'], 404);
        }

        if ($videoId) {
            $video = $videoRepository->find($videoId);
            if (!$video) {
                return new JsonResponse(['error' => 'Video nicht gefunden'], 404);
            }
        } else {
            $video = new Video();
            $video->setCreatedAt(new DateTimeImmutable());
            $video->setCreatedFrom($user);
            $video->setGame($game);
        }

        if ($cameraId) {
            $camera = $cameraRepository->find($cameraId);
            if (!$camera) {
                return new JsonResponse(['error' => 'Kamera nicht gefunden'], 404);
            }
            $video->setCamera($camera);
        }

        $video->setName($name);
        $video->setUrl($url);
        $video->setYoutubeId($youtubeId);
        $video->setVideoType($videoType);
        $video->setFilePath($filePath);
        $video->setGameStart(null !== $gameStart && '' !== $gameStart ? (int) $gameStart : null);
        $video->setSort(null !== $sort && '' !== $sort ? (int) $sort : null);
        $video->setUpdatedAt(new DateTimeImmutable());
        $video->setUpdatedFrom($user);
        $video->setLength(null !== $length && '' !== $length ? (int) $length : null);

        $em->persist($video);
        $em->flush();

        return new JsonResponse([
            'success' => true,
            'video' => [
                'id' => $video->getId(),
                'name' => $video->getName(),
                'url' => $video->getUrl(),
                'youtubeId' => $video->getYoutubeId(),
                'filePath' => $video->getFilePath(),
                'gameStart' => $video->getGameStart(),
                'sort' => $video->getSort(),
                'videoType' => [
                    'name' => $video->getVideoType()?->getName(),
                    'id' => $video->getVideoType()?->getId(),
                    'sort' => $video->getVideoType()?->getSort()
                ],
                'length' => $video->getLength(),
                'createdAt' => $video->getCreatedAt()?->format('c'),
                'updatedAt' => $video->getUpdatedAt()?->format('c'),
            ]
        ]);
    }

    #[Route('/videos/delete/{id}', name: 'videos_delete', methods: ['DELETE'])]
    public function delete(
        int $id,
        Request $request,
        VideoRepository $videoRepository,
        EntityManagerInterface $em,
        CsrfTokenManagerInterface $csrfTokenManager
    ): JsonResponse {
        $video = $videoRepository->find($id);
        if (!$video) {
            return new JsonResponse(['error' => 'Video nicht gefunden'], 404);
        }

        // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER oder Trainer dürfen Videos löschen
            // Nur Teammitglieder mit ROLE_ADMIN/ROLE_SUPPORTER dürfen Videos löschen
        if (!$this->isGranted(VideoVoter::DELETE, $video)) {
            return new JsonResponse(['error' => 'Zugriff verweigert – nur Teammitglieder können Videos löschen.'], 403);
        }

        $em->remove($video);
        $em->flush();

        return new JsonResponse(['success' => true]);
    }
}
