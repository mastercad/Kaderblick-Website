<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\BillingExemption;
use App\Entity\BillingSubscriptionTeam;
use App\Entity\Team;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

final class BillingAccessService
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    public function activeExemptionFor(Team $team, ?DateTimeImmutable $at = null): ?BillingExemption
    {
        $at ??= new DateTimeImmutable();
        /** @var list<BillingExemption> $items */
        $items = $this->em->getRepository(BillingExemption::class)->findBy(['active' => true], ['id' => 'DESC']);
        foreach ($items as $item) {
            if (!$item->appliesAt($at)) {
                continue;
            }
            if (BillingExemption::SCOPE_PLATFORM === $item->getScope()) {
                return $item;
            }
            if (BillingExemption::SCOPE_TEAM === $item->getScope() && $item->getTeam() === $team) {
                return $item;
            }
            if (BillingExemption::SCOPE_CLUB === $item->getScope() && null !== $item->getClub() && $team->getClubs()->contains($item->getClub())) {
                return $item;
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    public function statusFor(Team $team): array
    {
        if ($exemption = $this->activeExemptionFor($team)) {
            return ['status' => 'trial', 'access' => true, 'reason' => $exemption->getReason(), 'trialEndsAt' => $exemption->getEndsAt()?->format(DATE_ATOM)];
        }
        /** @var ?BillingSubscriptionTeam $link */
        $link = $this->em->getRepository(BillingSubscriptionTeam::class)->findOneBy(['team' => $team]);
        if (null === $link) {
            return ['status' => 'unpaid', 'access' => true, 'reason' => 'Noch kein Abonnement abgeschlossen'];
        }
        $subscription = $link->getSubscription();
        $blocked = $subscription->getMissedBillingCycles() >= 2;

        return [
            'status' => $blocked ? 'blocked' : $subscription->getStatus(),
            'access' => !$blocked,
            'reason' => $blocked ? 'Zwei Abrechnungszeiträume sind unbezahlt.' : null,
            'paidThrough' => $subscription->getCurrentPeriodEnd()?->format(DATE_ATOM),
            'missedBillingCycles' => $subscription->getMissedBillingCycles(),
            'payer' => trim(($subscription->getPayer()->getFirstName() ?? '') . ' ' . ($subscription->getPayer()->getLastName() ?? '')),
        ];
    }
}
