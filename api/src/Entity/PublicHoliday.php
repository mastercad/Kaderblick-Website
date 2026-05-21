<?php

namespace App\Entity;

use App\Repository\PublicHolidayRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PublicHolidayRepository::class)]
#[ORM\Table(name: 'public_holidays')]
#[ORM\UniqueConstraint(name: 'uq_public_holiday', columns: ['year', 'state_code', 'name'])]
class PublicHoliday
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore property.onlyRead */
    private int $id;

    #[ORM\Column(type: 'smallint', options: ['unsigned' => true])]
    private int $year;

    /** ISO-Länderkürzel z.B. 'BY', 'BW', 'NATIONAL' */
    #[ORM\Column(type: 'string', length: 20)]
    private string $stateCode;

    #[ORM\Column(type: 'string', length: 100)]
    private string $name;

    #[ORM\Column(type: 'date_immutable')]
    private DateTimeImmutable $date;

    #[ORM\Column(type: 'datetime_immutable')]
    private DateTimeImmutable $fetchedAt;

    public function __construct(
        int $year,
        string $stateCode,
        string $name,
        DateTimeImmutable $date,
    ) {
        $this->year = $year;
        $this->stateCode = $stateCode;
        $this->name = $name;
        $this->date = $date;
        $this->fetchedAt = new DateTimeImmutable();
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getYear(): int
    {
        return $this->year;
    }

    public function getStateCode(): string
    {
        return $this->stateCode;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDate(): DateTimeImmutable
    {
        return $this->date;
    }

    public function getFetchedAt(): DateTimeImmutable
    {
        return $this->fetchedAt;
    }
}
