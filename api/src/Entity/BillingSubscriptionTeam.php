<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'billing_subscription_teams')]
#[ORM\UniqueConstraint(name: 'uniq_billing_team_coverage', columns: ['team_id'])]
class BillingSubscriptionTeam
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    /** @phpstan-ignore-next-line Set by Doctrine. */
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: BillingSubscription::class, inversedBy: 'teamLinks')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private BillingSubscription $subscription;

    #[ORM\ManyToOne(targetEntity: Team::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Team $team;

    public function __construct(BillingSubscription $subscription, Team $team)
    {
        $this->subscription = $subscription;
        $this->team = $team;
    }

    public function getSubscription(): BillingSubscription
    {
        return $this->subscription;
    }

    public function getTeam(): Team
    {
        return $this->team;
    }

    public function getId(): ?int
    {
        return $this->id;
    }
}
