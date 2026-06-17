<?php

namespace App\Entity;

use App\Repository\FunctionaryTeamAssignmentTypeRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: FunctionaryTeamAssignmentTypeRepository::class)]
#[ORM\Table(name: 'functionary_team_assignment_types')]
class FunctionaryTeamAssignmentType
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['functionary_team_assignment_type:read', 'functionary_team_assignment:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private int $id;

    #[Groups(['functionary_team_assignment_type:read', 'functionary_team_assignment:read'])]
    #[ORM\Column(type: 'string', length: 100)]
    private ?string $name = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'boolean')]
    private bool $active = true;

    /** @var Collection<int, FunctionaryTeamAssignment> */
    #[ORM\OneToMany(targetEntity: FunctionaryTeamAssignment::class, mappedBy: 'functionaryTeamAssignmentType')]
    private Collection $functionaryTeamAssignments;

    public function __construct()
    {
        $this->functionaryTeamAssignments = new ArrayCollection();
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $active): void
    {
        $this->active = $active;
    }

    /** @return Collection<int, FunctionaryTeamAssignment> */
    public function getFunctionaryTeamAssignments(): Collection
    {
        return $this->functionaryTeamAssignments;
    }
}
