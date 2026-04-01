<?php

namespace App\Controller;

use App\Entity\User;
use App\Entity\Video;
use App\Entity\VideoSegment;
use App\Repository\VideoRepository;
use App\Repository\VideoSegmentRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class VideoSegmentController extends AbstractController
{
    #[Route('/video-segments', name: 'video_segments_list', methods: ['GET'])]
    public function list(
        Request $request,
        VideoSegmentRepository $videoSegmentRepository,
        VideoRepository $videoRepository
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['error' => 'Nicht authentifiziert'], Response::HTTP_UNAUTHORIZED);
        }

        $gameId = $request->query->get('gameId');
        $videoId = $request->query->get('videoId');

        if ($gameId) {
            $segments = $videoSegmentRepository->findByUserAndGame($user, (int) $gameId);
        } elseif ($videoId) {
            $video = $videoRepository->find($videoId);
            if (!$video) {
                return new JsonResponse(['error' => 'Video nicht gefunden'], Response::HTTP_NOT_FOUND);
            }
            $segments = $videoSegmentRepository->findByUserAndVideo($user, $video);
        } else {
            return new JsonResponse(['error' => 'gameId oder videoId Parameter erforderlich'], Response::HTTP_BAD_REQUEST);
        }

        $data = [];
        foreach ($segments as $segment) {
            $data[] = [
                'id' => $segment->getId(),
                'videoId' => $segment->getVideo()->getId(),
                'videoName' => $segment->getVideo()->getName(),
                'startMinute' => $segment->getStartMinute(),
                'lengthSeconds' => $segment->getLengthSeconds(),
                'title' => $segment->getTitle(),
                'subTitle' => $segment->getSubTitle(),
                'includeAudio' => $segment->isIncludeAudio(),
                'sortOrder' => $segment->getSortOrder(),
                'createdAt' => $segment->getCreatedAt()?->format('c'),
                'updatedAt' => $segment->getUpdatedAt()?->format('c'),
            ];
        }

        return new JsonResponse($data);
    }

    #[Route('/video-segments/{id}', name: 'video_segments_get', methods: ['GET'])]
    public function get(int $id, VideoSegmentRepository $videoSegmentRepository): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['error' => 'Nicht angemeldet'], Response::HTTP_UNAUTHORIZED);
        }

        $segment = $videoSegmentRepository->find($id);

        if (!$segment) {
            return new JsonResponse(['error' => 'Segment nicht gefunden'], 404);
        }

        if ($segment->getUser() !== $user) {
            return new JsonResponse(['error' => 'Zugriff verweigert'], 403);
        }

        return new JsonResponse([
            'id' => $segment->getId(),
            'videoId' => $segment->getVideo()->getId(),
            'videoName' => $segment->getVideo()->getName(),
            'startMinute' => $segment->getStartMinute(),
            'lengthSeconds' => $segment->getLengthSeconds(),
            'title' => $segment->getTitle(),
            'subTitle' => $segment->getSubTitle(),
            'includeAudio' => $segment->isIncludeAudio(),
            'sortOrder' => $segment->getSortOrder(),
            'createdAt' => $segment->getCreatedAt()?->format('c'),
            'updatedAt' => $segment->getUpdatedAt()?->format('c'),
        ]);
    }

    #[Route('/video-segments/save', name: 'video_segments_save', methods: ['POST'])]
    public function save(
        Request $request,
        VideoRepository $videoRepository,
        EntityManagerInterface $em,
        ValidatorInterface $validator
    ): JsonResponse {
        /** @var User|null $user */
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['error' => 'Nicht authentifiziert'], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);

        $video = $videoRepository->find($data['videoId'] ?? null);
        if (!$video) {
            return new JsonResponse(['error' => 'Video nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        $segment = new VideoSegment();
        $segment->setVideo($video);
        $segment->setUser($user);

        if (isset($data['startMinute'])) {
            $segment->setStartMinute($data['startMinute']);
        }
        if (isset($data['lengthSeconds'])) {
            $segment->setLengthSeconds($data['lengthSeconds']);
        }
        if (isset($data['title'])) {
            $segment->setTitle($data['title']);
        }
        if (isset($data['subTitle'])) {
            $segment->setSubTitle($data['subTitle']);
        }
        if (isset($data['includeAudio'])) {
            $segment->setIncludeAudio($data['includeAudio']);
        }
        if (isset($data['sortOrder'])) {
            $segment->setSortOrder($data['sortOrder']);
        }

        $errors = $validator->validate($segment);
        if (count($errors) > 0) {
            $errorMessages = [];
            foreach ($errors as $error) {
                $errorMessages[$error->getPropertyPath()] = $error->getMessage();
            }

            return new JsonResponse(['errors' => $errorMessages], Response::HTTP_BAD_REQUEST);
        }

        $em->persist($segment);
        $em->flush();

        return new JsonResponse([
            'id' => $segment->getId(),
            'videoId' => $segment->getVideo()->getId(),
            'videoName' => $segment->getVideo()->getName(),
            'startMinute' => $segment->getStartMinute(),
            'lengthSeconds' => $segment->getLengthSeconds(),
            'title' => $segment->getTitle(),
            'subTitle' => $segment->getSubTitle(),
            'includeAudio' => $segment->isIncludeAudio(),
            'sortOrder' => $segment->getSortOrder(),
            'createdAt' => $segment->getCreatedAt()?->format('c'),
            'updatedAt' => $segment->getUpdatedAt()?->format('c'),
        ], Response::HTTP_CREATED);
    }

    #[Route('/video-segments/update/{id}', name: 'video_segments_update', methods: ['POST'])]
    public function update(
        int $id,
        Request $request,
        VideoSegmentRepository $videoSegmentRepository,
        EntityManagerInterface $em,
        ValidatorInterface $validator
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['error' => 'Nicht angemeldet'], Response::HTTP_UNAUTHORIZED);
        }

        $segment = $videoSegmentRepository->find($id);

        if (!$segment) {
            return new JsonResponse(['error' => 'Segment nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        if ($segment->getUser() !== $user) {
            return new JsonResponse(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        if (isset($data['startMinute'])) {
            $segment->setStartMinute($data['startMinute']);
        }
        if (isset($data['lengthSeconds'])) {
            $segment->setLengthSeconds($data['lengthSeconds']);
        }
        if (isset($data['title'])) {
            $segment->setTitle($data['title']);
        }
        if (isset($data['subTitle'])) {
            $segment->setSubTitle($data['subTitle']);
        }
        if (isset($data['includeAudio'])) {
            $segment->setIncludeAudio($data['includeAudio']);
        }
        if (isset($data['sortOrder'])) {
            $segment->setSortOrder($data['sortOrder']);
        }

        $errors = $validator->validate($segment);
        if (count($errors) > 0) {
            $errorMessages = [];
            foreach ($errors as $error) {
                $errorMessages[$error->getPropertyPath()] = $error->getMessage();
            }

            return new JsonResponse(['errors' => $errorMessages], Response::HTTP_BAD_REQUEST);
        }

        $em->flush();

        return new JsonResponse([
            'id' => $segment->getId(),
            'videoId' => $segment->getVideo()->getId(),
            'videoName' => $segment->getVideo()->getName(),
            'startMinute' => $segment->getStartMinute(),
            'lengthSeconds' => $segment->getLengthSeconds(),
            'title' => $segment->getTitle(),
            'subTitle' => $segment->getSubTitle(),
            'includeAudio' => $segment->isIncludeAudio(),
            'sortOrder' => $segment->getSortOrder(),
            'createdAt' => $segment->getCreatedAt()?->format('c'),
            'updatedAt' => $segment->getUpdatedAt()?->format('c'),
        ]);
    }

    #[Route('/video-segments/delete/{id}', name: 'video_segments_delete', methods: ['POST', 'DELETE'])]
    public function delete(
        int $id,
        VideoSegmentRepository $videoSegmentRepository,
        EntityManagerInterface $em
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['error' => 'Nicht angemeldet'], Response::HTTP_UNAUTHORIZED);
        }

        $segment = $videoSegmentRepository->find($id);

        if (!$segment) {
            return new JsonResponse(['error' => 'Segment nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        if ($segment->getUser() !== $user) {
            return new JsonResponse(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $em->remove($segment);
        $em->flush();

        return new JsonResponse(['success' => true]);
    }

    #[Route('/video-segments/export/{gameId}', name: 'video_segments_export', methods: ['GET'])]
    public function export(
        int $gameId,
        VideoSegmentRepository $videoSegmentRepository
    ): Response {
        /** @var User|null $user */
        $user = $this->getUser();

        if (!$user) {
            return new JsonResponse(['error' => 'Nicht authentifiziert'], Response::HTTP_UNAUTHORIZED);
        }

        $segments = $videoSegmentRepository->findByUserAndGame($user, $gameId);

        $response = new StreamedResponse(function () use ($segments) {
            $handle = fopen('php://output', 'w');

            // CSV Header
            fputcsv($handle, ['videoname', 'start_minute', 'length_seconds', 'title', 'sub_title', 'audio']);

            foreach ($segments as $segment) {
                $video = $segment->getVideo();

                // Formatiere start_minute mit Komma als Dezimaltrennzeichen
                $startMinute = str_replace('.', ',', (string) $segment->getStartMinute());

                // Verwende Dateipfad falls vorhanden, sonst Video-Name
                $videoIdentifier = $video->getFilePath() ?: $video->getName();

                fputcsv($handle, [
                    $videoIdentifier,
                    $startMinute,
                    $segment->getLengthSeconds(),
                    $segment->getTitle() ?? '',
                    $segment->getSubTitle() ?? '',
                    $segment->isIncludeAudio() ? '1' : '0',
                ]);
            }

            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv; charset=utf-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="video-segments-export.csv"');

        return $response;
    }
}
