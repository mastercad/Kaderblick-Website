<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\BillingPayment;
use App\Entity\BillingSubscription;
use App\Entity\User;
use App\Service\BillingAccessService;
use App\Service\BillingManager;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/billing')]
final class BillingController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em, private BillingManager $billing, private BillingAccessService $access)
    {
    }

    #[Route('/overview', methods: ['GET'])]
    public function overview(): JsonResponse
    {
        $user = $this->requireUser();
        $teams = array_map(fn ($team) => ['id' => $team->getId(), 'name' => $team->getName(), ...$this->access->statusFor($team)], $this->billing->manageableTeams($user));
        $subscriptions = [];
        foreach ($this->em->getRepository(BillingSubscription::class)->findBy(['payer' => $user], ['id' => 'DESC']) as $subscription) {
            $payments = array_map(
                static fn (BillingPayment $payment) => $payment->toArray(),
                $this->em->getRepository(BillingPayment::class)->findBy(
                    ['subscription' => $subscription],
                    ['id' => 'DESC']
                )
            );
            $subscriptions[] = $this->subscriptionArray($subscription, $payments);
        }
        return $this->json([
            'stripeConfigured' => $this->billing->isStripeConfigured(),
            'unitAmount' => 1000,
            'currency' => 'EUR',
            'teams' => $teams,
            'subscriptions' => $subscriptions,
        ]);
    }

    #[Route('/checkout', methods: ['POST'])]
    public function checkout(Request $request): JsonResponse
    {
        try {
            $data = $request->toArray();
            $ids = array_values(array_map('intval', is_array($data['teamIds'] ?? null) ? $data['teamIds'] : []));
            return $this->json(['url' => $this->billing->createCheckout($this->requireUser(), $ids)]);
        } catch (RuntimeException $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        }
    }

    #[Route('/subscriptions/{id}/portal', methods: ['POST'])]
    public function portal(int $id): JsonResponse
    {
        $subscription = $this->em->getRepository(BillingSubscription::class)->find($id);
        if (!$subscription) {
            return $this->json(['error' => 'Abonnement nicht gefunden.'], 404);
        }
        try {
            return $this->json(['url' => $this->billing->createPortal($subscription, $this->requireUser())]);
        } catch (RuntimeException $e) {
            return $this->json(['error' => $e->getMessage()], 403);
        }
    }

    /**
     * @param list<array<string, mixed>> $payments
     * @return array<string, mixed>
     */
    private function subscriptionArray(BillingSubscription $subscription, array $payments = []): array
    {
        return [
            'id' => $subscription->getId(),
            'status' => $subscription->getStatus(),
            'teams' => array_map(
                static fn ($team) => ['id' => $team->getId(), 'name' => $team->getName()],
                $subscription->getTeams()
            ),
            'unitAmount' => $subscription->getUnitAmount(),
            'currency' => $subscription->getCurrency(),
            'currentPeriodEnd' => $subscription->getCurrentPeriodEnd()?->format(DATE_ATOM),
            'missedBillingCycles' => $subscription->getMissedBillingCycles(),
            'payments' => $payments,
            'createdAt' => $subscription->getCreatedAt()->format(DATE_ATOM),
        ];
    }

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException();
        }
        return $user;
    }
}
