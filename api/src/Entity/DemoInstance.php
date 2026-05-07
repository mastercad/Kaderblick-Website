<?php

namespace App\Entity;

use App\Repository\DemoInstanceRepository;
use DateTime;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: DemoInstanceRepository::class)]
#[ORM\Table(name: 'demo_instances')]
#[ORM\Index(name: 'idx_demo_instances_token', columns: ['demo_token'])]
#[ORM\Index(name: 'idx_demo_instances_status', columns: ['status'])]
class DemoInstance
{
    public const STATUS_PROVISIONING = 'provisioning';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REVOKED = 'revoked';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    /** @phpstan-ignore-next-line */
    private ?int $id = null;

    #[ORM\Column(length: 64, unique: true)]
    private string $demoToken;

    #[ORM\Column(length: 255)]
    private string $frontendUrl;

    #[ORM\Column(length: 255)]
    private string $apiUrl;

    #[ORM\Column(length: 128)]
    private string $dbName;

    #[ORM\Column(length: 128)]
    private string $dbUser;

    /** Verschlüsselt via sodium_crypto_secretbox mit APP_SECRET als Key. */
    #[ORM\Column(type: 'text')]
    private string $dbPasswordEncrypted;

    #[ORM\Column(length: 20)]
    private string $status = self::STATUS_PROVISIONING;

    #[ORM\Column(name: 'created_at', type: 'datetime')]
    private DateTime $createdAt;

    #[ORM\Column(name: 'expires_at', type: 'datetime', nullable: true)]
    private ?DateTime $expiresAt = null;

    #[ORM\OneToOne(targetEntity: DemoRequest::class)]
    #[ORM\JoinColumn(name: 'demo_request_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private DemoRequest $demoRequest;

    public function __construct()
    {
        $this->createdAt = new DateTime();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDemoToken(): string
    {
        return $this->demoToken;
    }

    public function setDemoToken(string $demoToken): self
    {
        $this->demoToken = $demoToken;

        return $this;
    }

    public function getFrontendUrl(): string
    {
        return $this->frontendUrl;
    }

    public function setFrontendUrl(string $frontendUrl): self
    {
        $this->frontendUrl = $frontendUrl;

        return $this;
    }

    public function getApiUrl(): string
    {
        return $this->apiUrl;
    }

    public function setApiUrl(string $apiUrl): self
    {
        $this->apiUrl = $apiUrl;

        return $this;
    }

    public function getDbName(): string
    {
        return $this->dbName;
    }

    public function setDbName(string $dbName): self
    {
        $this->dbName = $dbName;

        return $this;
    }

    public function getDbUser(): string
    {
        return $this->dbUser;
    }

    public function setDbUser(string $dbUser): self
    {
        $this->dbUser = $dbUser;

        return $this;
    }

    public function getDbPasswordEncrypted(): string
    {
        return $this->dbPasswordEncrypted;
    }

    public function setDbPasswordEncrypted(string $dbPasswordEncrypted): self
    {
        $this->dbPasswordEncrypted = $dbPasswordEncrypted;

        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;

        return $this;
    }

    public function isActive(): bool
    {
        return self::STATUS_ACTIVE === $this->status;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function getExpiresAt(): ?DateTime
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(?DateTime $expiresAt): self
    {
        $this->expiresAt = $expiresAt;

        return $this;
    }

    public function getDemoRequest(): DemoRequest
    {
        return $this->demoRequest;
    }

    public function setDemoRequest(DemoRequest $demoRequest): self
    {
        $this->demoRequest = $demoRequest;

        return $this;
    }
}
