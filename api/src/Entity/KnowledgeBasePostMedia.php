<?php

namespace App\Entity;

use App\Repository\KnowledgeBasePostMediaRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: KnowledgeBasePostMediaRepository::class)]
#[ORM\Table(name: 'knowledge_base_post_media')]
#[ORM\Index(name: 'idx_knowledge_base_post_media_post_id', columns: ['post_id'])]
class KnowledgeBasePostMedia
{
    public const TYPE_YOUTUBE = 'youtube';
    public const TYPE_VIMEO = 'vimeo';
    public const TYPE_SPOTIFY = 'spotify';
    public const TYPE_SOUNDCLOUD = 'soundcloud';
    public const TYPE_IMAGE = 'image';
    public const TYPE_VIDEO = 'video';
    public const TYPE_GENERIC = 'generic';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: KnowledgeBasePost::class, inversedBy: 'mediaLinks')]
    #[ORM\JoinColumn(name: 'post_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private KnowledgeBasePost $post;

    #[ORM\Column(type: 'string', length: 2048)]
    private string $url;

    /** Detected platform type: youtube, vimeo, spotify, soundcloud, generic. */
    #[ORM\Column(type: 'string', length: 20)]
    private string $mediaType = self::TYPE_GENERIC;

    /** Optional label / title for this link. */
    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $label = null;

    /** Extracted video/track ID for embedding (e.g. YouTube video ID). */
    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $externalId = null;

    /**
     * Resolved thumbnail URL for card preview.
     * Set at save-time by probing the URL (oEmbed, HEAD content-type, etc.).
     * Null means no visual preview is available.
     */
    #[ORM\Column(type: 'string', length: 2048, nullable: true)]
    private ?string $thumbnailUrl = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPost(): KnowledgeBasePost
    {
        return $this->post;
    }

    public function setPost(KnowledgeBasePost $post): self
    {
        $this->post = $post;

        return $this;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): self
    {
        $this->url = $url;

        return $this;
    }

    public function getMediaType(): string
    {
        return $this->mediaType;
    }

    public function setMediaType(string $mediaType): self
    {
        $this->mediaType = $mediaType;

        return $this;
    }

    public function getLabel(): ?string
    {
        return $this->label;
    }

    public function setLabel(?string $label): self
    {
        $this->label = $label;

        return $this;
    }

    public function getExternalId(): ?string
    {
        return $this->externalId;
    }

    public function setExternalId(?string $externalId): self
    {
        $this->externalId = $externalId;

        return $this;
    }

    public function getThumbnailUrl(): ?string
    {
        return $this->thumbnailUrl;
    }

    public function setThumbnailUrl(?string $thumbnailUrl): self
    {
        $this->thumbnailUrl = $thumbnailUrl;

        return $this;
    }
}
