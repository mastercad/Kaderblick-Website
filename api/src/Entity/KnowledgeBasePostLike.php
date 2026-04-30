<?php

namespace App\Entity;

use App\Repository\KnowledgeBasePostLikeRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: KnowledgeBasePostLikeRepository::class)]
#[ORM\Table(name: 'knowledge_base_post_likes')]
#[ORM\UniqueConstraint(name: 'uniq_knowledge_base_like_post_user', columns: ['post_id', 'user_id'])]
#[ORM\Index(name: 'idx_knowledge_base_post_likes_post_id', columns: ['post_id'])]
#[ORM\Index(name: 'idx_knowledge_base_post_likes_user_id', columns: ['user_id'])]
class KnowledgeBasePostLike
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: KnowledgeBasePost::class, inversedBy: 'likes')]
    #[ORM\JoinColumn(name: 'post_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private KnowledgeBasePost $post;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

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

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
