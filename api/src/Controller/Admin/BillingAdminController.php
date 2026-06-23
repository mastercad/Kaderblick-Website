<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\BillingExemption;
use App\Entity\BillingPayment;
use App\Entity\BillingSubscription;
use App\Entity\Club;
use App\Entity\Team;
use App\Entity\User;
use App\Service\BillingAccessService;
use App\Service\BillingManager;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/superadmin/billing')]
#[IsGranted('ROLE_SUPERADMIN')]
final class BillingAdminController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em, private BillingAccessService $access, private BillingManager $billing)
    {
    }

    #[Route('', methods: ['GET'])]
    public function overview(): JsonResponse
    {
        $teams = array_map(
            fn (Team $team) => [
                'id' => $team->getId(),
                'name' => $team->getName(),
                'clubs' => array_map(
                    static fn (Club $club) => ['id' => $club->getId(), 'name' => $club->getName()],
                    $team->getClubs()->toArray()
                ),
                ...$this->access->statusFor($team),
            ],
            $this->em->getRepository(Team::class)->findBy([], ['name' => 'ASC'])
        );
        $clubs = array_map(static fn (Club $club) => ['id' => $club->getId(), 'name' => $club->getName()], $this->em->getRepository(Club::class)->findBy([], ['name' => 'ASC']));
        $exemptions = array_map(static fn (BillingExemption $item) => $item->toArray(), $this->em->getRepository(BillingExemption::class)->findBy([], ['id' => 'DESC']));
        $subscriptions = [];
        foreach ($this->em->getRepository(BillingSubscription::class)->findBy([], ['id' => 'DESC']) as $subscription) {
            $payments = array_map(
                static fn (BillingPayment $payment) => $payment->toArray(),
                $this->em->getRepository(BillingPayment::class)->findBy(
                    ['subscription' => $subscription],
                    ['id' => 'DESC']
                )
            );
            $payer = $subscription->getPayer();
            $subscriptions[] = [
                'id' => $subscription->getId(),
                'payer' => [
                    'id' => $payer->getId(),
                    'name' => trim(($payer->getFirstName() ?? '') . ' ' . ($payer->getLastName() ?? '')),
                    'email' => $payer->getEmail(),
                ],
                'teams' => array_map(
                    static fn (Team $team) => ['id' => $team->getId(), 'name' => $team->getName()],
                    $subscription->getTeams()
                ),
                'status' => $subscription->getStatus(),
                'amount' => count($subscription->getTeams()) * $subscription->getUnitAmount(),
                'currency' => $subscription->getCurrency(),
                'periodEnd' => $subscription->getCurrentPeriodEnd()?->format(DATE_ATOM),
                'missedBillingCycles' => $subscription->getMissedBillingCycles(),
                'payments' => $payments,
            ];
        }
        return $this->json(['teams' => $teams, 'clubs' => $clubs, 'exemptions' => $exemptions, 'subscriptions' => $subscriptions]);
    }

    #[Route('/exemptions', methods: ['POST'])]
    public function createExemption(Request $request): JsonResponse
    {
        try {
            $data = $request->toArray();
            $scope = (string) ($data['scope'] ?? '');
            if (!in_array($scope, [BillingExemption::SCOPE_PLATFORM, BillingExemption::SCOPE_CLUB, BillingExemption::SCOPE_TEAM], true)) {
                throw new RuntimeException('Ungültiger Testphasen-Bereich.');
            }
            $reason = trim((string) ($data['reason'] ?? ''));
            if ('' === $reason) {
                throw new RuntimeException('Eine Begründung ist erforderlich.');
            }
            $user = $this->getUser();
            $item = new BillingExemption($scope, $reason, $user instanceof User ? $user : null);
            if (BillingExemption::SCOPE_CLUB === $scope) {
                $club = $this->em->getRepository(Club::class)->find((int) ($data['clubId'] ?? 0));
                if (!$club) {
                    throw new RuntimeException('Verein nicht gefunden.');
                }
                $item->setClub($club);
            }
            if (BillingExemption::SCOPE_TEAM === $scope) {
                $team = $this->em->getRepository(Team::class)->find((int) ($data['teamId'] ?? 0));
                if (!$team) {
                    throw new RuntimeException('Team nicht gefunden.');
                }
                $item->setTeam($team);
            }
            $item->setStartsAt(!empty($data['startsAt']) ? new DateTimeImmutable((string) $data['startsAt']) : new DateTimeImmutable())
                ->setEndsAt(!empty($data['endsAt']) ? new DateTimeImmutable((string) $data['endsAt']) : null);
            if ($item->getEndsAt() && $item->getStartsAt() && $item->getEndsAt() <= $item->getStartsAt()) {
                throw new RuntimeException('Das Ende muss nach dem Beginn liegen.');
            }
            $this->em->persist($item);
            $this->em->flush();
            try {
                $this->billing->syncTrialCollection();
            } catch (RuntimeException) {
                return $this->json(['error' => 'Die Testphase wurde gespeichert, konnte aber noch nicht vollständig angewendet werden. Bitte versuche es später erneut.'], 502);
            }
            return $this->json(['exemption' => $item->toArray()], 201);
        } catch (RuntimeException | \Exception $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        }
    }

    #[Route('/exemptions/{id}', methods: ['DELETE'])]
    public function deactivateExemption(int $id): JsonResponse
    {
        $item = $this->em->getRepository(BillingExemption::class)->find($id);
        if (!$item) {
            return $this->json(['error' => 'Testphase nicht gefunden.'], 404);
        }
        $item->end();
        $this->em->flush();
        try {
            $this->billing->syncTrialCollection();
        } catch (RuntimeException) {
            return $this->json(['error' => 'Die Testphase wurde gespeichert, konnte aber noch nicht vollständig angewendet werden. Bitte versuche es später erneut.'], 502);
        }
        return $this->json(['success' => true]);
    }
}
