<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\BillingPayment;
use App\Entity\BillingSubscription;
use App\Entity\BillingWebhookEvent;
use App\Service\BillingNotificationService;
use App\Service\StripeBillingClient;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use JsonException;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class StripeWebhookController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em, private StripeBillingClient $stripe, private BillingNotificationService $notifications)
    {
    }

    #[Route('/api/billing/webhook/stripe', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        try {
            $event = $this->stripe->verifyWebhook($request->getContent(), (string) $request->headers->get('Stripe-Signature'));
        } catch (RuntimeException|JsonException $e) {
            return $this->json(['error' => $e->getMessage()], 400);
        }
        $eventId = (string) ($event['id'] ?? '');
        if ('' === $eventId) {
            return $this->json(['error' => 'Event-ID fehlt.'], 400);
        }
        if ($this->em->getRepository(BillingWebhookEvent::class)->findOneBy(['providerEventId' => $eventId])) {
            return $this->json(['received' => true, 'duplicate' => true]);
        }

        $type = (string) ($event['type'] ?? 'unknown');
        $object = $event['data']['object'] ?? [];
        if (!is_array($object)) {
            return $this->json(['error' => 'Event-Objekt fehlt.'], 400);
        }
        $notify = null;
        $subscription = null;

        if ('checkout.session.completed' === $type) {
            $subscription = $this->findLocal((string) ($object['client_reference_id'] ?? $object['metadata']['billing_subscription_id'] ?? ''));
            if ($subscription) {
                $subscription->setProviderCustomerId(isset($object['customer']) ? (string) $object['customer'] : null)
                    ->setProviderSubscriptionId(isset($object['subscription']) ? (string) $object['subscription'] : null);
            }
        } elseif (str_starts_with($type, 'customer.subscription.')) {
            $subscription = $this->findLocal((string) ($object['metadata']['billing_subscription_id'] ?? ''));
            if (!$subscription && isset($object['id'])) {
                $subscription = $this->em->getRepository(BillingSubscription::class)->findOneBy(['providerSubscriptionId' => (string) $object['id']]);
            }
            if ($subscription) {
                $item = $object['items']['data'][0] ?? [];
                $subscription->setProviderSubscriptionId((string) ($object['id'] ?? $subscription->getProviderSubscriptionId()))
                    ->setProviderSubscriptionItemId(isset($item['id']) ? (string) $item['id'] : $subscription->getProviderSubscriptionItemId())
                    ->setStatus($this->mapStatus((string) ($object['status'] ?? 'pending')))
                    ->setCurrentPeriodStart($this->date($object['current_period_start'] ?? $item['current_period_start'] ?? null))
                    ->setCurrentPeriodEnd($this->date($object['current_period_end'] ?? $item['current_period_end'] ?? null));
                if ('customer.subscription.deleted' === $type) {
                    $subscription->setStatus(BillingSubscription::STATUS_CANCELED);
                }
            }
        } elseif (in_array($type, ['invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required'], true)) {
            $providerSubscriptionId = (string) ($object['subscription'] ?? $object['parent']['subscription_details']['subscription'] ?? '');
            $subscription = $this->em->getRepository(BillingSubscription::class)->findOneBy(['providerSubscriptionId' => $providerSubscriptionId]);
            if ($subscription) {
                $invoiceId = (string) ($object['id'] ?? '');
                /** @var ?BillingPayment $payment */
                $payment = $this->em->getRepository(BillingPayment::class)->findOneBy(['providerInvoiceId' => $invoiceId]);
                $isNew = null === $payment;
                $payment ??= new BillingPayment(
                    $subscription,
                    $invoiceId,
                    (string) ($object['status'] ?? 'open'),
                    (int) ($object['amount_paid'] ?? $object['amount_due'] ?? 0),
                    (string) ($object['currency'] ?? 'eur')
                );
                $payment->setStatus((string) ($object['status'] ?? ('invoice.paid' === $type ? 'paid' : 'open')))
                    ->setInvoiceUrl(isset($object['hosted_invoice_url']) ? (string) $object['hosted_invoice_url'] : null)
                    ->setInvoicePdfUrl(isset($object['invoice_pdf']) ? (string) $object['invoice_pdf'] : null);
                $this->em->persist($payment);
                if ('invoice.paid' === $type) {
                    $payment->setPaidAt($this->date($object['status_transitions']['paid_at'] ?? time()));
                    $subscription->setStatus(BillingSubscription::STATUS_ACTIVE)->setUnpaidSince(null)->setMissedBillingCycles(0);
                    $period = $object['lines']['data'][0]['period'] ?? [];
                    $subscription->setCurrentPeriodStart($this->date($period['start'] ?? null))->setCurrentPeriodEnd($this->date($period['end'] ?? null));
                } else {
                    if ($isNew) {
                        $subscription->setMissedBillingCycles($subscription->getMissedBillingCycles() + 1);
                    }
                    $subscription->setStatus(BillingSubscription::STATUS_PAST_DUE)->setUnpaidSince($subscription->getUnpaidSince() ?? new DateTimeImmutable());
                    $notify = 'invoice.payment_action_required' === $type ? 'Zahlung erfordert eine Bestätigung' : 'Zahlungsversuch fehlgeschlagen';
                }
            }
        }

        $this->em->persist(new BillingWebhookEvent($eventId, $type));
        $this->em->flush();
        if ($notify && $subscription) {
            $this->notifications->paymentMissing($subscription, $notify);
        }

        return $this->json(['received' => true]);
    }

    private function findLocal(string $id): ?BillingSubscription
    {
        return ctype_digit($id) ? $this->em->getRepository(BillingSubscription::class)->find((int) $id) : null;
    }

    private function date(mixed $timestamp): ?DateTimeImmutable
    {
        return is_numeric($timestamp) ? (new DateTimeImmutable())->setTimestamp((int) $timestamp) : null;
    }

    private function mapStatus(string $status): string
    {
        return match ($status) {
            'active', 'trialing' => BillingSubscription::STATUS_ACTIVE,
            'past_due', 'unpaid', 'incomplete' => BillingSubscription::STATUS_PAST_DUE,
            'paused' => BillingSubscription::STATUS_PAUSED,
            'canceled', 'incomplete_expired' => BillingSubscription::STATUS_CANCELED,
            default => BillingSubscription::STATUS_PENDING,
        };
    }
}
