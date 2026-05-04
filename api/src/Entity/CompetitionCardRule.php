<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\CompetitionCardRuleRepository;
use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

/**
 * Konfigurierbare Gelb-Karten-Regeln pro Wettbewerbstyp.
 *
 * competition_id = NULL bedeutet: Regel gilt für alle Wettbewerbe dieses Typs.
 * Spezifische Regeln (competition_id gesetzt) haben Vorrang vor generischen.
 */
#[ORM\Entity(repositoryClass: CompetitionCardRuleRepository::class)]
#[ORM\Table(name: 'competition_card_rules')]
#[ORM\Index(columns: ['competition_type', 'competition_id'], name: 'idx_card_rule_competition')]
#[ORM\Index(columns: ['valid_from'], name: 'idx_card_rule_valid_from')]
#[ORM\Index(columns: ['valid_until'], name: 'idx_card_rule_valid_until')]
class CompetitionCardRule
{
    public const TYPE_LEAGUE = 'league';
    public const TYPE_CUP = 'cup';
    public const TYPE_TOURNAMENT = 'tournament';
    public const TYPE_FRIENDLY = 'friendly';

    public const ALLOWED_TYPES = [self::TYPE_LEAGUE, self::TYPE_CUP, self::TYPE_TOURNAMENT, self::TYPE_FRIENDLY];

    public const PERSON_PLAYER = 'player';
    public const PERSON_COACH = 'coach';
    public const PERSON_ALL = 'all';

    public const ALLOWED_PERSON_TYPES = [self::PERSON_PLAYER, self::PERSON_COACH, self::PERSON_ALL];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    /** @phpstan-ignore-next-line Property is set by Doctrine and never written in code */
    private ?int $id = null;

    /** @var string one of TYPE_* constants */
    #[ORM\Column(length: 20)]
    private string $competitionType;

    /**
     * NULL = gilt für alle Wettbewerbe dieses Typs.
     * Gesetzt = gilt nur für diesen spezifischen Wettbewerb (league_id / cup_id / tournament_id).
     */
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $competitionId = null;

    /** Ab dieser Anzahl Gelber Karten geht eine Warnung raus. */
    #[ORM\Column(type: 'smallint')]
    private int $yellowWarningThreshold = 4;

    /** Ab dieser Anzahl Gelber Karten wird der Spieler gesperrt. */
    #[ORM\Column(type: 'smallint')]
    private int $yellowSuspensionThreshold = 5;

    /** Anzahl Spiele Sperre nach Erreichen des Gelb-Schwellenwerts. */
    #[ORM\Column(type: 'smallint')]
    private int $suspensionGames = 1;

    /** Anzahl Spiele Sperre bei Roter Karte. */
    #[ORM\Column(type: 'smallint', name: 'red_card_suspension_games')]
    private int $redCardSuspensionGames = 1;

    /** Anzahl Spiele Sperre bei Gelb-Roter Karte. */
    #[ORM\Column(type: 'smallint', name: 'yellow_red_card_suspension_games')]
    private int $yellowRedCardSuspensionGames = 1;

    /**
     * Für wen gilt diese Regel?
     *
     * @see self::PERSON_* constants
     */
    #[ORM\Column(length: 10, name: 'person_type')]
    private string $personType = self::PERSON_ALL;

    /**
     * Wird der Gelb-Karten-Zähler nach Abbüßen der Sperre zurückgesetzt?
     * Typisch im deutschen Amateurfußball: ja.
     */
    #[ORM\Column(type: 'boolean')]
    private bool $resetAfterSuspension = true;

    /**
     * Erster Tag, ab dem diese Regel gilt (inklusive).
     * NULL = gilt ab sofort (kein Startdatum).
     */
    #[ORM\Column(type: 'date_immutable', nullable: true, name: 'valid_from')]
    private ?DateTimeImmutable $validFrom = null;

    /**
     * Letzter Tag, bis zu dem diese Regel gilt (inklusive).
     * NULL = gilt unbegrenzt.
     */
    #[ORM\Column(type: 'date_immutable', nullable: true, name: 'valid_until')]
    private ?DateTimeImmutable $validUntil = null;

    public function __construct(
        string $competitionType,
        ?int $competitionId = null,
        int $yellowWarningThreshold = 4,
        int $yellowSuspensionThreshold = 5,
        int $suspensionGames = 1,
        int $redCardSuspensionGames = 1,
        int $yellowRedCardSuspensionGames = 1,
        string $personType = self::PERSON_ALL,
        bool $resetAfterSuspension = true,
        ?DateTimeImmutable $validFrom = null,
        ?DateTimeImmutable $validUntil = null,
    ) {
        $this->competitionType = $competitionType;
        $this->competitionId = $competitionId;
        $this->yellowWarningThreshold = $yellowWarningThreshold;
        $this->yellowSuspensionThreshold = $yellowSuspensionThreshold;
        $this->suspensionGames = $suspensionGames;
        $this->redCardSuspensionGames = $redCardSuspensionGames;
        $this->yellowRedCardSuspensionGames = $yellowRedCardSuspensionGames;
        $this->personType = $personType;
        $this->resetAfterSuspension = $resetAfterSuspension;
        $this->validFrom = $validFrom;
        $this->validUntil = $validUntil;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCompetitionType(): string
    {
        return $this->competitionType;
    }

    public function setCompetitionType(string $competitionType): self
    {
        $this->competitionType = $competitionType;

        return $this;
    }

    public function getCompetitionId(): ?int
    {
        return $this->competitionId;
    }

    public function setCompetitionId(?int $competitionId): self
    {
        $this->competitionId = $competitionId;

        return $this;
    }

    public function getYellowWarningThreshold(): int
    {
        return $this->yellowWarningThreshold;
    }

    public function setYellowWarningThreshold(int $yellowWarningThreshold): self
    {
        $this->yellowWarningThreshold = $yellowWarningThreshold;

        return $this;
    }

    public function getYellowSuspensionThreshold(): int
    {
        return $this->yellowSuspensionThreshold;
    }

    public function setYellowSuspensionThreshold(int $yellowSuspensionThreshold): self
    {
        $this->yellowSuspensionThreshold = $yellowSuspensionThreshold;

        return $this;
    }

    public function getSuspensionGames(): int
    {
        return $this->suspensionGames;
    }

    public function setSuspensionGames(int $suspensionGames): self
    {
        $this->suspensionGames = $suspensionGames;

        return $this;
    }

    public function getRedCardSuspensionGames(): int
    {
        return $this->redCardSuspensionGames;
    }

    public function setRedCardSuspensionGames(int $redCardSuspensionGames): self
    {
        $this->redCardSuspensionGames = $redCardSuspensionGames;

        return $this;
    }

    public function getYellowRedCardSuspensionGames(): int
    {
        return $this->yellowRedCardSuspensionGames;
    }

    public function setYellowRedCardSuspensionGames(int $yellowRedCardSuspensionGames): self
    {
        $this->yellowRedCardSuspensionGames = $yellowRedCardSuspensionGames;

        return $this;
    }

    public function getPersonType(): string
    {
        return $this->personType;
    }

    public function setPersonType(string $personType): self
    {
        $this->personType = $personType;

        return $this;
    }

    public function isResetAfterSuspension(): bool
    {
        return $this->resetAfterSuspension;
    }

    public function setResetAfterSuspension(bool $resetAfterSuspension): self
    {
        $this->resetAfterSuspension = $resetAfterSuspension;

        return $this;
    }

    public function getValidFrom(): ?DateTimeImmutable
    {
        return $this->validFrom;
    }

    public function setValidFrom(?DateTimeImmutable $validFrom): self
    {
        $this->validFrom = $validFrom;

        return $this;
    }

    public function getValidUntil(): ?DateTimeImmutable
    {
        return $this->validUntil;
    }

    public function setValidUntil(?DateTimeImmutable $validUntil): self
    {
        $this->validUntil = $validUntil;

        return $this;
    }

    /** Ist diese Regel zum gegebenen Datum aktiv? */
    public function isActiveAt(DateTimeImmutable $date): bool
    {
        if (null !== $this->validFrom && $date < $this->validFrom) {
            return false;
        }
        if (null !== $this->validUntil && $date > $this->validUntil) {
            return false;
        }

        return true;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'competitionType' => $this->competitionType,
            'competitionId' => $this->competitionId,
            'personType' => $this->personType,
            'yellowWarningThreshold' => $this->yellowWarningThreshold,
            'yellowSuspensionThreshold' => $this->yellowSuspensionThreshold,
            'suspensionGames' => $this->suspensionGames,
            'redCardSuspensionGames' => $this->redCardSuspensionGames,
            'yellowRedCardSuspensionGames' => $this->yellowRedCardSuspensionGames,
            'resetAfterSuspension' => $this->resetAfterSuspension,
            'validFrom' => $this->validFrom?->format('Y-m-d'),
            'validUntil' => $this->validUntil?->format('Y-m-d'),
        ];
    }
}
