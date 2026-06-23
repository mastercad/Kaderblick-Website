<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\BillingSubscription;
use App\Entity\BillingSubscriptionTeam;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\Team;
use App\Entity\User;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;
use Throwable;

final class BillingManager
{
    public function __construct(
        private EntityManagerInterface $em,
        private BillingAccessService $access,
        private StripeBillingClient $stripe,
        private string $frontendUrl,
    ) {
    }

    public function isStripeConfigured(): bool
    {
        return $this->stripe->isConfigured();
    }

    /** @return list<Team> */
    public function manageableTeams(User $user): array
    {
        $teams = [];
        foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]) as $assignment) {
            if (
                'Kassenwart' === $assignment->getFunctionaryTeamAssignmentType()?->getName()
                && $this->assignmentIsCurrent($assignment->getStartDate(), $assignment->getEndDate())
                && $assignment->getTeam()
            ) {
                $teams[$assignment->getTeam()->getId()] = $assignment->getTeam();
            }
        }
        foreach ($this->em->getRepository(FunctionaryClubAssignment::class)->findBy(['user' => $user]) as $assignment) {
            if (
                'Kassenwart' !== $assignment->getFunctionaryClubAssignmentType()?->getName()
                || !$this->assignmentIsCurrent($assignment->getStartDate(), $assignment->getEndDate())
                || !$assignment->getClub()
            ) {
                continue;
            }
            foreach ($assignment->getClub()->getTeams() as $team) {
                $teams[$team->getId()] = $team;
            }
        }
        if (in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            foreach ($this->em->getRepository(Team::class)->findAll() as $team) {
                $teams[$team->getId()] = $team;
            }
        }

        return array_values($teams);
    }

    /** @param list<int> $teamIds */
    public function createCheckout(User $user, array $teamIds): string
    {
        if (!$this->stripe->isConfigured()) {
            throw new RuntimeException('Abos können zurzeit noch nicht abgeschlossen werden.');
        }
        $allowed = [];
        foreach ($this->manageableTeams($user) as $team) {
            $allowed[$team->getId()] = $team;
        }
        $selected = [];
        foreach (array_values(array_unique($teamIds)) as $teamId) {
            if (!isset($allowed[$teamId])) {
                throw new RuntimeException('Mindestens ein Team darf von diesem Benutzer nicht abgerechnet werden.');
            }
            $team = $allowed[$teamId];
            if ($this->access->activeExemptionFor($team)) {
                throw new RuntimeException($team->getName() . ' befindet sich derzeit in einer kostenlosen Testphase.');
            }
            /** @var ?BillingSubscriptionTeam $existing */
            $existing = $this->em->getRepository(BillingSubscriptionTeam::class)->findOneBy(['team' => $team]);
            if ($existing) {
                $old = $existing->getSubscription();
                $periodEnded = null === $old->getCurrentPeriodEnd() || $old->getCurrentPeriodEnd() <= new DateTimeImmutable();
                if (BillingSubscription::STATUS_CANCELED === $old->getStatus() && $periodEnded) {
                    $this->em->remove($existing);
                    $this->em->flush();
                } else {
                    throw new RuntimeException($team->getName() . ' ist bereits durch ein Abonnement abgedeckt.');
                }
            }
            $selected[] = $team;
        }
        if ([] === $selected) {
            throw new RuntimeException('Bitte mindestens ein Team auswählen.');
        }

        $subscription = new BillingSubscription($user);
        foreach ($selected as $team) {
            $subscription->addTeam($team);
        }
        $this->em->persist($subscription);
        $this->em->flush();

        try {
            $session = $this->stripe->post('/checkout/sessions', [
                'mode' => 'subscription',
                'locale' => 'de',
                'success_url' => rtrim($this->frontendUrl, '/') . '/abrechnung?checkout=success',
                'cancel_url' => rtrim($this->frontendUrl, '/') . '/abrechnung?checkout=canceled',
                'client_reference_id' => (string) $subscription->getId(),
                'customer_email' => (string) $user->getEmail(),
                'billing_address_collection' => 'required',
                'tax_id_collection' => ['enabled' => 'true'],
                'line_items' => [[
                    'quantity' => count($selected),
                    'price_data' => [
                        'currency' => 'eur',
                        'unit_amount' => 1000,
                        'recurring' => ['interval' => 'month'],
                        'product_data' => ['name' => 'Kaderblick Team-Abo', 'description' => 'Monatlicher Plattformzugang pro Team'],
                    ],
                ]],
                'metadata' => ['billing_subscription_id' => (string) $subscription->getId()],
                'subscription_data' => ['metadata' => ['billing_subscription_id' => (string) $subscription->getId()]],
            ]);
        } catch (Throwable $e) {
            $this->em->remove($subscription);
            $this->em->flush();
            throw new RuntimeException('Die Zahlungsseite konnte nicht geöffnet werden. Bitte versuche es später erneut.', 0, $e);
        }

        return (string) ($session['url'] ?? throw new RuntimeException('Die Zahlungsseite konnte nicht geöffnet werden.'));
    }

    public function createPortal(BillingSubscription $subscription, User $user): string
    {
        if ($subscription->getPayer() !== $user && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            throw new RuntimeException('Dieses Abonnement darf nicht verwaltet werden.');
        }
        if (!$subscription->getProviderCustomerId()) {
            throw new RuntimeException('Das Abonnement wurde noch nicht vollständig aktiviert.');
        }
        try {
            $session = $this->stripe->post('/billing_portal/sessions', [
                'customer' => $subscription->getProviderCustomerId(),
                'return_url' => rtrim($this->frontendUrl, '/') . '/abrechnung',
            ]);
        } catch (Throwable $e) {
            throw new RuntimeException('Die Abonnementverwaltung konnte nicht geöffnet werden. Bitte versuche es später erneut.', 0, $e);
        }

        return (string) ($session['url'] ?? throw new RuntimeException('Die Abonnementverwaltung konnte nicht geöffnet werden.'));
    }

    public function syncTrialCollection(): void
    {
        /** @var list<BillingSubscription> $subscriptions */
        $subscriptions = $this->em->getRepository(BillingSubscription::class)->findAll();
        foreach ($subscriptions as $subscription) {
            if (
                !$subscription->getProviderSubscriptionId()
                || !$subscription->getProviderSubscriptionItemId()
                || BillingSubscription::STATUS_CANCELED === $subscription->getStatus()
            ) {
                continue;
            }
            $billable = count(array_filter($subscription->getTeams(), fn (Team $team) => null === $this->access->activeExemptionFor($team)));
            if (0 === $billable && !$subscription->isCollectionPausedByTrial()) {
                $this->stripe->post('/subscriptions/' . $subscription->getProviderSubscriptionId(), ['pause_collection' => ['behavior' => 'void']]);
                $subscription->setCollectionPausedByTrial(true)->setStatus(BillingSubscription::STATUS_PAUSED);
            } elseif ($billable > 0) {
                $parameters = ['items' => [['id' => $subscription->getProviderSubscriptionItemId(), 'quantity' => $billable]], 'proration_behavior' => 'none'];
                if ($subscription->isCollectionPausedByTrial()) {
                    $parameters['pause_collection'] = '';
                }
                $this->stripe->post('/subscriptions/' . $subscription->getProviderSubscriptionId(), $parameters);
                $subscription->setCollectionPausedByTrial(false);
                if (BillingSubscription::STATUS_PAUSED === $subscription->getStatus()) {
                    $subscription->setStatus(BillingSubscription::STATUS_ACTIVE);
                }
            }
        }
        $this->em->flush();
    }

    private function assignmentIsCurrent(?DateTimeInterface $start, ?DateTimeInterface $end): bool
    {
        $today = new DateTimeImmutable('today');

        return (null === $start || $start <= $today) && (null === $end || $end >= $today);
    }
}
