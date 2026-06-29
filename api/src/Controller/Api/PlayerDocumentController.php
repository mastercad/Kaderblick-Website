<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\Player;
use App\Entity\PlayerDocument;
use App\Entity\User;
use App\Message\ProcessPlayerDocumentMessage;
use App\Repository\PlayerDocumentRepository;
use App\Service\PlayerDocumentAccessService;
use App\Service\PlayerDocumentDriveStorage;
use App\Service\PlayerDocumentStagingStorage;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api')]
#[IsGranted('IS_AUTHENTICATED')]
class PlayerDocumentController extends AbstractController
{
    private const CATEGORIES = ['pass', 'medical', 'consent', 'contract', 'other'];
    private const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PlayerDocumentRepository $documents,
        private readonly PlayerDocumentAccessService $access,
        private readonly PlayerDocumentDriveStorage $driveStorage,
        private readonly PlayerDocumentStagingStorage $stagingStorage,
        private readonly MessageBusInterface $messageBus,
    ) {
    }

    #[Route('/players/{id}/documents', methods: ['GET'])]
    public function index(Player $player): JsonResponse
    {
        $user = $this->currentUser();
        $visible = array_filter($this->documents->findForPlayer($player), fn (PlayerDocument $d) => $this->access->canView($user, $d));
        $manageableClubAssignments = array_filter($player->getPlayerClubAssignments()->toArray(), fn ($a) => $this->access->canManageClubDocument($user, $player, $a->getClub()));

        return $this->json([
            'documents' => array_map(fn (PlayerDocument $d) => $this->normalise($d), array_values($visible)),
            'canManage' => count($manageableClubAssignments) > 0,
            'clubs' => array_values(array_map(
                fn ($a) => ['id' => $a->getClub()->getId(), 'name' => $a->getClub()->getName()],
                $manageableClubAssignments
            )),
        ]);
    }

    #[Route('/players/{id}/documents', methods: ['POST'])]
    public function upload(Player $player, Request $request): JsonResponse
    {
        $user = $this->currentUser();
        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile || !$file->isValid()) {
            return $this->json(['error' => 'Keine gültige Datei übermittelt'], 400);
        }
        if (($file->getSize() ?: 0) > 15 * 1024 * 1024) {
            return $this->json(['error' => 'Die Datei darf maximal 15 MB groß sein'], 400);
        }
        $mime = (string) $file->getMimeType();
        if (!in_array($mime, self::MIMES, true)) {
            return $this->json(['error' => 'Erlaubt sind PDF, JPEG, PNG und WebP'], 400);
        }
        $club = $this->em->getRepository(Club::class)->find((int) $request->request->get('clubId'));
        $belongsToClub = $club && $player->getPlayerClubAssignments()->exists(fn ($key, $a) => $a->getClub()->getId() === $club->getId());
        if (!$belongsToClub) {
            return $this->json(['error' => 'Der Verein ist diesem Spieler nicht zugeordnet'], 400);
        }
        if (!$this->access->canManageClubDocument($user, $player, $club)) {
            return $this->json(['error' => 'Zugriff auf diesen Verein verweigert'], 403);
        }

        $extension = match ($mime) {
            'application/pdf' => 'pdf', 'image/png' => 'png', 'image/webp' => 'webp', default => 'jpg'
        };
        $storageKey = 'documents/' . bin2hex(random_bytes(24)) . '.' . $extension;
        try {
            $this->stagingStorage->upload($file, $storageKey);
        } catch (Throwable) {
            return $this->json(['error' => 'Temporärer Dokumentenspeicher ist nicht erreichbar'], 503);
        }

        $requestedCategory = (string) $request->request->get('category', 'auto');
        $automaticClassification = 'auto' === $requestedCategory;
        $category = $automaticClassification ? 'other' : $requestedCategory;
        if (!in_array($category, self::CATEGORIES, true)) {
            $category = 'other';
        }

        $document = (new PlayerDocument())
            ->setPlayer($player)->setClub($club)->setUploadedBy($user)->setCategory($category)
            ->setDisplayName(trim((string) $request->request->get('displayName')) ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME))
            ->setStorageKey($storageKey)->setOriginalFilename($file->getClientOriginalName())
            ->setMimeType($mime)->setFileSize((int) $file->getSize())->setChecksum((string) hash_file('sha256', $file->getPathname()))
            ->setAutomaticClassification($automaticClassification)->setProcessingStatus('pending')
            ->setIssuedAt($this->date($request->request->get('issuedAt')))
            ->setExpiresAt($this->date($request->request->get('expiresAt')))
            ->setNotes(trim((string) $request->request->get('notes')) ?: null);
        try {
            $this->em->persist($document);
            $this->em->flush();
        } catch (Throwable $exception) {
            $this->stagingStorage->delete($storageKey);
            throw $exception;
        }
        try {
            $this->messageBus->dispatch(new ProcessPlayerDocumentMessage((int) $document->getId()));
            $document->setProcessingDispatchedAt(new DateTimeImmutable())->setProcessingError(null);
            $this->em->flush();
        } catch (Throwable $exception) {
            // Der Datensatz selbst ist die transaktionale Outbox. Der Cron-Relay stellt später erneut zu.
            $document->setProcessingError('Queue vorübergehend nicht erreichbar; erneuter Versand ist eingeplant.');
            $this->em->flush();
        }

        return $this->json(['document' => $this->normalise($document)], 202);
    }

    #[Route('/player-documents/{id}', methods: ['PATCH'])]
    public function update(PlayerDocument $document, Request $request): JsonResponse
    {
        if (!$this->access->canManageClubDocument($this->currentUser(), $document->getPlayer(), $document->getClub())) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }
        $data = json_decode($request->getContent(), true) ?: [];
        if (isset($data['displayName']) && trim($data['displayName'])) {
            $document->setDisplayName(trim($data['displayName']));
        }
        if (isset($data['category']) && in_array($data['category'], self::CATEGORIES, true)) {
            $document->setCategory($data['category']);
        }
        if (array_key_exists('issuedAt', $data)) {
            $document->setIssuedAt($this->date($data['issuedAt']));
        }
        if (array_key_exists('expiresAt', $data)) {
            $document->setExpiresAt($this->date($data['expiresAt']));
        }
        if (array_key_exists('notes', $data)) {
            $document->setNotes(trim((string) $data['notes']) ?: null);
        }
        $this->em->flush();

        return $this->json(['document' => $this->normalise($document)]);
    }

    #[Route('/player-documents/{id}/content', methods: ['GET'])]
    public function content(PlayerDocument $document): Response
    {
        if (!$this->access->canView($this->currentUser(), $document)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }
        if ($document->getDriveFileId()) {
            try {
                $contents = $this->driveStorage->download($document);
            } catch (Throwable) {
                return $this->json(['error' => 'Dokument konnte nicht geladen werden'], 502);
            }
            $response = new Response($contents);
            $response->headers->set('Content-Disposition', $response->headers->makeDisposition(ResponseHeaderBag::DISPOSITION_INLINE, $document->getOriginalFilename()));
        } else {
            $storageKey = $document->getStorageKey();
            if (!$storageKey) {
                return $this->json(['error' => 'Das Dokument wird noch verarbeitet'], 409);
            }
            try {
                $contents = $this->stagingStorage->download($storageKey);
            } catch (Throwable) {
                return $this->json(['error' => 'Temporäres Dokument konnte nicht geladen werden'], 502);
            }
            $response = new Response($contents);
            $response->headers->set('Content-Disposition', $response->headers->makeDisposition(ResponseHeaderBag::DISPOSITION_INLINE, $document->getOriginalFilename()));
        }
        $response->headers->set('Content-Type', $document->getMimeType());
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    #[Route('/player-documents/{id}', methods: ['DELETE'])]
    public function delete(PlayerDocument $document): Response
    {
        if (!$this->access->canManageClubDocument($this->currentUser(), $document->getPlayer(), $document->getClub())) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }
        try {
            $this->driveStorage->delete($document);
        } catch (Throwable) {
            return $this->json(['error' => 'Dokument konnte nicht aus Google Drive gelöscht werden'], 502);
        }
        $storageKey = $document->getStorageKey();
        if ($storageKey) {
            try {
                $this->stagingStorage->delete($storageKey);
            } catch (Throwable) {
                return $this->json(['error' => 'Temporäres Dokument konnte nicht gelöscht werden'], 502);
            }
        }
        $this->em->remove($document);
        $this->em->flush();

        return new Response(null, 204);
    }

    /** @return array<string, mixed> */
    private function normalise(PlayerDocument $d): array
    {
        return ['id' => $d->getId(), 'displayName' => $d->getDisplayName(), 'category' => $d->getCategory(),
            'originalFilename' => $d->getOriginalFilename(), 'mimeType' => $d->getMimeType(), 'fileSize' => $d->getFileSize(),
            'issuedAt' => $d->getIssuedAt()?->format('Y-m-d'), 'expiresAt' => $d->getExpiresAt()?->format('Y-m-d'),
            'notes' => $d->getNotes(), 'ocrDetected' => '' !== trim((string) $d->getOcrText()),
            'processingStatus' => $d->getProcessingStatus(), 'processingError' => $d->getProcessingError(),
            'createdAt' => $d->getCreatedAt()->format(DATE_ATOM),
            'club' => ['id' => $d->getClub()->getId(), 'name' => $d->getClub()->getName()],
            'canManage' => $this->access->canManageClubDocument($this->currentUser(), $d->getPlayer(), $d->getClub())];
    }

    private function currentUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException();
        }

        return $user;
    }

    private function date(mixed $value): ?DateTimeImmutable
    {
        if (!is_string($value) || '' === trim($value)) {
            return null;
        } $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date ?: null;
    }
}
