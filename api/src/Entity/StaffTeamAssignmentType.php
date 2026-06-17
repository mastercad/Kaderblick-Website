<?php

namespace App\Entity;

use App\Repository\StaffTeamAssignmentTypeRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: StaffTeamAssignmentTypeRepository::class)]
#[ORM\Table(name: 'staff_team_assignment_types')]
class StaffTeamAssignmentType
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['staff_team_assignment_type:read', 'staff_team_assignment:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private int $id;

    #[Groups(['staff_team_assignment_type:read', 'staff_team_assignment:read'])]
    #[ORM\Column(type: 'string', length: 100)]
    private ?string $name = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $description = null;

    #[ORM\Column(type: 'boolean')]
    private bool $active = true;

    /** @var Collection<int, StaffTeamAssignment> */
    #[ORM\OneToMany(targetEntity: StaffTeamAssignment::class, mappedBy: 'staffTeamAssignmentType')]
    private Collection $staffTeamAssignments;

    public function __construct()
    {
        $this->staffTeamAssignments = new ArrayCollection();
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

    /** @return Collection<int, StaffTeamAssignment> */
    public function getStaffTeamAssignments(): Collection
    {
        return $this->staffTeamAssignments;
    }
}
