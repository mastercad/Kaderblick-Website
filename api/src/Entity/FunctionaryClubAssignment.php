<?php

namespace App\Entity;

use App\Repository\FunctionaryClubAssignmentRepository;
use DateTimeInterface;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: FunctionaryClubAssignmentRepository::class)]
#[ORM\Table(name: 'functionary_club_assignments')]
#[ORM\Index(name: 'idx_functionary_club_assignment_user_id', columns: ['user_id'])]
#[ORM\Index(name: 'idx_functionary_club_assignment_club_id', columns: ['club_id'])]
#[ORM\Index(name: 'idx_functionary_club_assignment_type_id', columns: ['functionary_club_assignment_type_id'])]
class FunctionaryClubAssignment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['functionary_club_assignment:read'])]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private int $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['functionary_club_assignment:read'])]
    private ?User $user = null;

    #[ORM\ManyToOne(targetEntity: Club::class)]
    #[ORM\JoinColumn(name: 'club_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    #[Groups(['functionary_club_assignment:read'])]
    private ?Club $club = null;

    #[ORM\ManyToOne(targetEntity: FunctionaryClubAssignmentType::class, inversedBy: 'functionaryClubAssignments')]
    #[ORM\JoinColumn(name: 'functionary_club_assignment_type_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    #[Groups(['functionary_club_assignment:read'])]
    private ?FunctionaryClubAssignmentType $functionaryClubAssignmentType = null;

    #[ORM\Column(type: 'date', nullable: true)]
    #[Groups(['functionary_club_assignment:read'])]
    private ?DateTimeInterface $startDate = null;

    #[ORM\Column(type: 'date', nullable: true)]
    #[Groups(['functionary_club_assignment:read'])]
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

    public function getClub(): ?Club
    {
        return $this->club;
    }

    public function setClub(?Club $club): void
    {
        $this->club = $club;
    }

    public function getFunctionaryClubAssignmentType(): ?FunctionaryClubAssignmentType
    {
        return $this->functionaryClubAssignmentType;
    }

    public function setFunctionaryClubAssignmentType(?FunctionaryClubAssignmentType $type): void
    {
        $this->functionaryClubAssignmentType = $type;
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
