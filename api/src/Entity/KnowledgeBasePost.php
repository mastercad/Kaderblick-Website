<?php

namespace App\Entity;

use App\Repository\KnowledgeBasePostRepository;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: KnowledgeBasePostRepository::class)]
#[ORM\Table(name: 'knowledge_base_posts')]
#[ORM\Index(name: 'idx_knowledge_base_posts_team_id', columns: ['team_id'])]
#[ORM\Index(name: 'idx_knowledge_base_posts_category_id', columns: ['category_id'])]
#[ORM\Index(name: 'idx_knowledge_base_posts_created_by', columns: ['created_by'])]
class KnowledgeBasePost
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    #[ORM\ManyToOne(targetEntity: KnowledgeBaseCategory::class, inversedBy: 'posts')]
    #[ORM\JoinColumn(name: 'category_id', referencedColumnName: 'id', nullable: false)]
    private KnowledgeBaseCategory $category;

    #[ORM\Column(type: 'string', length: 255)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $isPinned = false;

    /** Whether to send a push notification to all team members on creation. */
    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $sendNotification = false;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'created_by', referencedColumnName: 'id', nullable: false)]
    private User $createdBy;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'updated_by', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $updatedBy = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $updatedAt = null;

    /**
     * @var Collection<int, KnowledgeBasePostMedia>
     */
    #[ORM\OneToMany(mappedBy: 'post', targetEntity: KnowledgeBasePostMedia::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $mediaLinks;

    /**
     * @var Collection<int, KnowledgeBaseTag>
     */
    #[ORM\ManyToMany(targetEntity: KnowledgeBaseTag::class, inversedBy: 'posts')]
    #[ORM\JoinTable(name: 'knowledge_base_post_tags')]
    private Collection $tags;

    /**
     * @var Collection<int, KnowledgeBasePostLike>
     */
    #[ORM\OneToMany(mappedBy: 'post', targetEntity: KnowledgeBasePostLike::class, cascade: ['remove'], orphanRemoval: true)]
    private Collection $likes;

    /**
     * @var Collection<int, KnowledgeBasePostComment>
     */
    #[ORM\OneToMany(mappedBy: 'post', targetEntity: KnowledgeBasePostComment::class, cascade: ['remove'], orphanRemoval: true)]
    private Collection $comments;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
        $this->mediaLinks = new ArrayCollection();
        $this->tags = new ArrayCollection();
        $this->likes = new ArrayCollection();
        $this->comments = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTeam(): ?Team
    {
        return $this->team;
    }

    public function setTeam(?Team $team): self
    {
        $this->team = $team;

        return $this;
    }

    public function getCategory(): KnowledgeBaseCategory
    {
        return $this->category;
    }

    public function setCategory(KnowledgeBaseCategory $category): self
    {
        $this->category = $category;

        return $this;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    public function isPinned(): bool
    {
        return $this->isPinned;
    }

    public function setIsPinned(bool $isPinned): self
    {
        $this->isPinned = $isPinned;

        return $this;
    }

    public function isSendNotification(): bool
    {
        return $this->sendNotification;
    }

    public function setSendNotification(bool $sendNotification): self
    {
        $this->sendNotification = $sendNotification;

        return $this;
    }

    public function getCreatedBy(): User
    {
        return $this->createdBy;
    }

    public function setCreatedBy(User $createdBy): self
    {
        $this->createdBy = $createdBy;

        return $this;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedBy(): ?User
    {
        return $this->updatedBy;
    }

    public function setUpdatedBy(?User $updatedBy): self
    {
        $this->updatedBy = $updatedBy;

        return $this;
    }

    public function getUpdatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTimeImmutable $updatedAt): self
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }

    /** @return Collection<int, KnowledgeBasePostMedia> */
    public function getMediaLinks(): Collection
    {
        return $this->mediaLinks;
    }

    public function addMediaLink(KnowledgeBasePostMedia $media): self
    {
        if (!$this->mediaLinks->contains($media)) {
            $this->mediaLinks->add($media);
            $media->setPost($this);
        }

        return $this;
    }

    public function removeMediaLink(KnowledgeBasePostMedia $media): self
    {
        $this->mediaLinks->removeElement($media);

        return $this;
    }

    /** @return Collection<int, KnowledgeBaseTag> */
    public function getTags(): Collection
    {
        return $this->tags;
    }

    public function addTag(KnowledgeBaseTag $tag): self
    {
        if (!$this->tags->contains($tag)) {
            $this->tags->add($tag);
        }

        return $this;
    }

    public function removeTag(KnowledgeBaseTag $tag): self
    {
        $this->tags->removeElement($tag);

        return $this;
    }

    /** @return Collection<int, KnowledgeBasePostLike> */
    public function getLikes(): Collection
    {
        return $this->likes;
    }

    /** @return Collection<int, KnowledgeBasePostComment> */
    public function getComments(): Collection
    {
        return $this->comments;
    }
}
