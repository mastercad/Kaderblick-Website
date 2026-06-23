<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\BillingSubscription;
use App\Entity\BillingExemption;
use App\Service\BillingManager;
use App\Service\BillingNotificationService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:billing:process', description: 'Synchronisiert Testphasen, Mahnstufen und Zugriffsstatus der Team-Abonnements')]
final class ProcessBillingCommand extends AbstractCronCommand
{
    public function __construct(private EntityManagerInterface $em, private BillingManager $billing, private BillingNotificationService $notifications)
    {
        parent::__construct();
    }

    protected function doCronExecute(InputInterface $input, OutputInterface $output): int
    {
        $now = new DateTimeImmutable();
        /** @var list<BillingExemption> $exemptions */
        $exemptions = $this->em->getRepository(BillingExemption::class)->findBy(['active' => true]);
        foreach ($exemptions as $exemption) {
            if ($exemption->getEndsAt() && $exemption->getEndsAt() <= $now) {
                $exemption->end($exemption->getEndsAt());
            }
        }
        $this->em->flush();
        $this->billing->syncTrialCollection();
        $changed = 0;
        /** @var list<BillingSubscription> $subscriptions */
        $subscriptions = $this->em->getRepository(BillingSubscription::class)->findAll();
        foreach ($subscriptions as $subscription) {
            if (BillingSubscription::STATUS_PENDING === $subscription->getStatus() && $subscription->getCreatedAt() < $now->modify('-24 hours')) {
                $this->em->remove($subscription);
                ++$changed;
                continue;
            }
            $since = $subscription->getUnpaidSince();
            if (BillingSubscription::STATUS_CANCELED === $subscription->getStatus() && $subscription->getCurrentPeriodEnd() && $subscription->getCurrentPeriodEnd() < $now) {
                $since ??= $subscription->getCurrentPeriodEnd();
                $subscription->setUnpaidSince($since);
            }
            if (!$since || !in_array($subscription->getStatus(), [BillingSubscription::STATUS_PAST_DUE, BillingSubscription::STATUS_CANCELED], true)) {
                continue;
            }
            $days = max(0, (int) $since->diff($now)->format('%a'));
            $cycles = min(2, 1 + intdiv($days, 30));
            if ($cycles > $subscription->getMissedBillingCycles()) {
                $subscription->setMissedBillingCycles($cycles);
                $this->notifications->paymentMissing(
                    $subscription,
                    2 === $cycles
                        ? 'Zweiter Abrechnungszeitraum offen – Teamzugriff wurde gesperrt'
                        : 'Erster Abrechnungszeitraum offen'
                );
                ++$changed;
            }
        }
        $this->em->flush();
        $output->writeln(sprintf('%d Abrechnungsstatus aktualisiert.', $changed));
        return self::SUCCESS;
    }
}
