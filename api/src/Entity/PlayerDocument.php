<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\PlayerDocumentRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PlayerDocumentRepository::class)]
#[ORM\Table(name: 'player_documents')]
#[ORM\Index(columns: ['player_id'], name: 'idx_player_document_player')]
#[ORM\Index(columns: ['club_id'], name: 'idx_player_document_club')]
#[ORM\Index(columns: ['expires_at'], name: 'idx_player_document_expiry')]
#[ORM\Index(columns: ['processing_status', 'processing_dispatched_at'], name: 'IDX_PLAYER_DOCUMENT_OUTBOX')]
class PlayerDocument
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    /** @phpstan-ignore-next-line Property is set by Doctrine */
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Player $player;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Club $club;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'uploaded_by_user_id', nullable: true, onDelete: 'SET NULL')]
    private ?User $uploadedBy = null;

    #[ORM\Column(length: 40)]
    private string $category = 'other';

    #[ORM\Column(length: 255)]
    private string $displayName;

    #[ORM\Column(length: 255, nullable: true, unique: true)]
    private ?string $storageKey = null;

    #[ORM\Column(length: 255, nullable: true, unique: true)]
    private ?string $driveFileId = null;

    #[ORM\Column(length: 20)]
    private string $processingStatus = 'pending';

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $processingError = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $processingDispatchedAt = null;

    #[ORM\Column]
    private bool $automaticClassification = true;

    #[ORM\Column(length: 255)]
    private string $originalFilename;

    #[ORM\Column(length: 100)]
    private string $mimeType;

    #[ORM\Column]
    private int $fileSize;

    #[ORM\Column(length: 64)]
    private string $checksum;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $ocrText = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $issuedAt = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $expiresAt = null;

    /** @var array<string, string> */
    #[ORM\Column(type: Types::JSON)]
    private array $expiryNotificationsSent = [];

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $notes = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPlayer(): Player
    {
        return $this->player;
    }

    public function setPlayer(Player $value): self
    {
        $this->player = $value;

        return $this;
    }

    public function getClub(): Club
    {
        return $this->club;
    }

    public function setClub(Club $value): self
    {
        $this->club = $value;

        return $this;
    }

    public function getUploadedBy(): ?User
    {
        return $this->uploadedBy;
    }

    public function setUploadedBy(User $value): self
    {
        $this->uploadedBy = $value;

        return $this;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(string $value): self
    {
        $this->category = $value;

        return $this;
    }

    public function getDisplayName(): string
    {
        return $this->displayName;
    }

    public function setDisplayName(string $value): self
    {
        $this->displayName = $value;

        return $this;
    }

    public function getStorageKey(): ?string
    {
        return $this->storageKey;
    }

    public function setStorageKey(?string $value): self
    {
        $this->storageKey = $value;

        return $this;
    }

    public function getDriveFileId(): ?string
    {
        return $this->driveFileId;
    }

    public function setDriveFileId(?string $value): self
    {
        $this->driveFileId = $value;

        return $this;
    }

    public function getProcessingStatus(): string
    {
        return $this->processingStatus;
    }

    public function setProcessingStatus(string $value): self
    {
        $this->processingStatus = $value;

        return $this;
    }

    public function getProcessingError(): ?string
    {
        return $this->processingError;
    }

    public function setProcessingError(?string $value): self
    {
        $this->processingError = $value;

        return $this;
    }

    public function getProcessingDispatchedAt(): ?DateTimeImmutable
    {
        return $this->processingDispatchedAt;
    }

    public function setProcessingDispatchedAt(?DateTimeImmutable $value): self
    {
        $this->processingDispatchedAt = $value;

        return $this;
    }

    public function isAutomaticClassification(): bool
    {
        return $this->automaticClassification;
    }

    public function setAutomaticClassification(bool $value): self
    {
        $this->automaticClassification = $value;

        return $this;
    }

    public function getOriginalFilename(): string
    {
        return $this->originalFilename;
    }

    public function setOriginalFilename(string $value): self
    {
        $this->originalFilename = $value;

        return $this;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function setMimeType(string $value): self
    {
        $this->mimeType = $value;

        return $this;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function setFileSize(int $value): self
    {
        $this->fileSize = $value;

        return $this;
    }

    public function getChecksum(): string
    {
        return $this->checksum;
    }

    public function setChecksum(string $value): self
    {
        $this->checksum = $value;

        return $this;
    }

    public function getOcrText(): ?string
    {
        return $this->ocrText;
    }

    public function setOcrText(?string $value): self
    {
        $this->ocrText = $value;

        return $this;
    }

    public function getIssuedAt(): ?DateTimeImmutable
    {
        return $this->issuedAt;
    }

    public function setIssuedAt(?DateTimeImmutable $value): self
    {
        $this->issuedAt = $value;

        return $this;
    }

    public function getExpiresAt(): ?DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(?DateTimeImmutable $value): self
    {
        if ($this->expiresAt?->format('Y-m-d') !== $value?->format('Y-m-d')) {
            $this->expiryNotificationsSent = [];
        }
        $this->expiresAt = $value;

        return $this;
    }

    /** @return array<string, string> */
    public function getExpiryNotificationsSent(): array
    {
        return $this->expiryNotificationsSent;
    }

    public function markExpiryNotificationSent(string $key): self
    {
        $this->expiryNotificationsSent[$key] = (new DateTimeImmutable())->format(DATE_ATOM);

        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $value): self
    {
        $this->notes = $value;

        return $this;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
