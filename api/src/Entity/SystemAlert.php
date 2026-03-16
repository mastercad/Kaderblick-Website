<?php

namespace App\Entity;

use App\Enum\SystemAlertCategory;
use App\Repository\SystemAlertRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SystemAlertRepository::class)]
#[ORM\Table(name: 'system_alerts')]
#[ORM\Index(columns: ['fingerprint'], name: 'idx_system_alerts_fingerprint')]
#[ORM\Index(columns: ['category'], name: 'idx_system_alerts_category')]
#[ORM\Index(columns: ['is_resolved'], name: 'idx_system_alerts_resolved')]
class SystemAlert
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    /** @phpstan-ignore-next-line */
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 50, enumType: SystemAlertCategory::class)]
    private SystemAlertCategory $category;

    /** MD5 fingerprint used to group identical alerts */
    #[ORM\Column(type: 'string', length: 32)]
    private string $fingerprint;

    #[ORM\Column(type: 'text')]
    private string $message;

    #[ORM\Column(type: 'string', length: 2048, nullable: true)]
    private ?string $requestUri = null;

    #[ORM\Column(type: 'string', length: 10, nullable: true)]
    private ?string $httpMethod = null;

    #[ORM\Column(type: 'string', length: 45, nullable: true)]
    private ?string $clientIp = null;

    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $exceptionClass = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $stackTrace = null;

    /** @var array<string, mixed>|null */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $context = null;

    #[ORM\Column(type: 'integer')]
    private int $occurrenceCount = 1;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $firstOccurrenceAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $lastOccurrenceAt;

    #[ORM\Column(type: 'boolean')]
    private bool $isResolved = false;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $resolvedAt = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $resolvedNote = null;

    public function __construct(SystemAlertCategory $category, string $fingerprint, string $message)
    {
        $this->category = $category;
        $this->fingerprint = $fingerprint;
        $this->message = $message;
        $this->firstOccurrenceAt = new DateTimeImmutable();
        $this->lastOccurrenceAt = new DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCategory(): SystemAlertCategory
    {
        return $this->category;
    }

    public function getFingerprint(): string
    {
        return $this->fingerprint;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function getRequestUri(): ?string
    {
        return $this->requestUri;
    }

    public function setRequestUri(?string $requestUri): static
    {
        $this->requestUri = $requestUri;

        return $this;
    }

    public function getHttpMethod(): ?string
    {
        return $this->httpMethod;
    }

    public function setHttpMethod(?string $httpMethod): static
    {
        $this->httpMethod = $httpMethod;

        return $this;
    }

    public function getClientIp(): ?string
    {
        return $this->clientIp;
    }

    public function setClientIp(?string $clientIp): static
    {
        $this->clientIp = $clientIp;

        return $this;
    }

    public function getExceptionClass(): ?string
    {
        return $this->exceptionClass;
    }

    public function setExceptionClass(?string $exceptionClass): static
    {
        $this->exceptionClass = $exceptionClass;

        return $this;
    }

    public function getStackTrace(): ?string
    {
        return $this->stackTrace;
    }

    public function setStackTrace(?string $stackTrace): static
    {
        $this->stackTrace = $stackTrace;

        return $this;
    }

    /** @return array<string, mixed>|null */
    public function getContext(): ?array
    {
        return $this->context;
    }

    /** @param array<string, mixed>|null $context */
    public function setContext(?array $context): static
    {
        $this->context = $context;

        return $this;
    }

    public function getOccurrenceCount(): int
    {
        return $this->occurrenceCount;
    }

    public function incrementOccurrence(): static
    {
        ++$this->occurrenceCount;
        $this->lastOccurrenceAt = new DateTimeImmutable();

        return $this;
    }

    public function getFirstOccurrenceAt(): DateTimeImmutable
    {
        return $this->firstOccurrenceAt;
    }

    public function getLastOccurrenceAt(): DateTimeImmutable
    {
        return $this->lastOccurrenceAt;
    }

    public function isResolved(): bool
    {
        return $this->isResolved;
    }

    public function resolve(?string $note = null): static
    {
        $this->isResolved = true;
        $this->resolvedAt = new DateTimeImmutable();
        $this->resolvedNote = $note;

        return $this;
    }

    public function reopen(): static
    {
        $this->isResolved = false;
        $this->resolvedAt = null;
        $this->resolvedNote = null;

        return $this;
    }

    public function getResolvedAt(): ?DateTimeImmutable
    {
        return $this->resolvedAt;
    }

    public function getResolvedNote(): ?string
    {
        return $this->resolvedNote;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category->value,
            'categoryLabel' => $this->category->label(),
            'categoryIcon' => $this->category->icon(),
            'categoryColor' => $this->category->color(),
            'fingerprint' => $this->fingerprint,
            'message' => $this->message,
            'requestUri' => $this->requestUri,
            'httpMethod' => $this->httpMethod,
            'clientIp' => $this->clientIp,
            'exceptionClass' => $this->exceptionClass,
            'stackTrace' => $this->stackTrace,
            'context' => $this->context,
            'occurrenceCount' => $this->occurrenceCount,
            'firstOccurrenceAt' => $this->firstOccurrenceAt->format('c'),
            'lastOccurrenceAt' => $this->lastOccurrenceAt->format('c'),
            'isResolved' => $this->isResolved,
            'resolvedAt' => $this->resolvedAt?->format('c'),
            'resolvedNote' => $this->resolvedNote,
        ];
    }
}
