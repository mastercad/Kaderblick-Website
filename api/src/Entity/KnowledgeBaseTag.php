<?php

namespace App\Entity;

use App\Repository\KnowledgeBaseTagRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: KnowledgeBaseTagRepository::class)]
#[ORM\Table(name: 'knowledge_base_tags')]
#[ORM\UniqueConstraint(name: 'uniq_knowledge_base_tag_name_team', columns: ['name', 'team_id'])]
class KnowledgeBaseTag
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 50)]
    private string $name;

    /** NULL = global tag (available to all teams). */
    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?Team $team = null;

    /**
     * @var Collection<int, KnowledgeBasePost>
     */
    #[ORM\ManyToMany(targetEntity: KnowledgeBasePost::class, mappedBy: 'tags')]
    private Collection $posts;

    public function __construct()
    {
        $this->posts = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
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

    /** @return Collection<int, KnowledgeBasePost> */
    public function getPosts(): Collection
    {
        return $this->posts;
    }
}
