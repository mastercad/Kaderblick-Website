<?php

namespace App\Entity;

use App\Repository\FunctionaryTeamAssignmentRepository;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: FunctionaryTeamAssignmentRepository::class)]
#[ORM\Table(name: 'functionary_team_assignments')]
#[ORM\Index(name: 'idx_functionary_team_assignment_user_id', columns: ['user_id'])]
#[ORM\Index(name: 'idx_functionary_team_assignment_team_id', columns: ['team_id'])]
#[ORM\Index(name: 'idx_functionary_team_assignment_type_id', columns: ['functionary_team_assignment_type_id'])]
class FunctionaryTeamAssignment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['functionary_team_assignment:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private int $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['functionary_team_assignment:read'])]
    private ?User $user = null;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(name: 'team_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['functionary_team_assignment:read'])]
    private ?Team $team = null;

    #[ORM\ManyToOne(targetEntity: FunctionaryTeamAssignmentType::class, inversedBy: 'functionaryTeamAssignments')]
    #[ORM\JoinColumn(name: 'functionary_team_assignment_type_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['functionary_team_assignment:read'])]
    private ?FunctionaryTeamAssignmentType $functionaryTeamAssignmentType = null;

    #[ORM\Column(type: 'date', nullable: true)]
    #[Groups(['functionary_team_assignment:read'])]
    private ?DateTimeInterface $startDate = null;

    #[ORM\Column(type: 'date', nullable: true)]
    #[Groups(['functionary_team_assignment:read'])]
    private ?DateTimeInterface $endDate = null;

    public function getId(): int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): void
    {
        $this->user = $user;
    }

    public function getTeam(): ?Team
    {
        return $this->team;
    }

    public function setTeam(?Team $team): void
    {
        $this->team = $team;
    }

    public function getFunctionaryTeamAssignmentType(): ?FunctionaryTeamAssignmentType
    {
        return $this->functionaryTeamAssignmentType;
    }

    public function setFunctionaryTeamAssignmentType(?FunctionaryTeamAssignmentType $type): void
    {
        $this->functionaryTeamAssignmentType = $type;
    }

    public function getStartDate(): ?DateTimeInterface
    {
        return $this->startDate;
    }

    public function setStartDate(?DateTimeInterface $startDate): void
    {
        $this->startDate = $startDate;
    }

    public function getEndDate(): ?DateTimeInterface
    {
        return $this->endDate;
    }

    public function setEndDate(?DateTimeInterface $endDate): void
    {
        $this->endDate = $endDate;
    }
}
