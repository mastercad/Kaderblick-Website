<?php

namespace App\Controller\Api;

use App\Entity\PushSubscription;
use App\Entity\User;
use App\Repository\NotificationRepository;
use App\Repository\PushSubscriptionRepository;
use App\Service\PushNotificationService;
use DateInterval;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api/push', name: 'api_push_')]
#[IsGranted('ROLE_USER')]
class PushController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private PushSubscriptionRepository $pushSubscriptionRepository,
        private ParameterBagInterface $params,
        private PushNotificationService $pushNotificationService,
        private NotificationRepository $notificationRepository
    ) {
    }

    /**
     * Get VAPID public key for push subscription.
     */
    #[Route('/vapid-key', name: 'vapid_key', methods: ['GET'])]
    public function getVapidKey(): JsonResponse
    {
        $publicKey = $this->params->get('vapid_public_key');

        if (!$publicKey) {
            return $this->json(['error' => 'VAPID key not configured'], 500);
        }

        return $this->json(['key' => $publicKey]);
    }

    /**
     * Subscribe to push notifications.
     */
    #[Route('/subscribe', name: 'subscribe', methods: ['POST'])]
    public function subscribe(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true);

        if (!isset($data['subscription'])) {
            return $this->json(['error' => 'Invalid subscription data'], 400);
        }

        $subscriptionData = $data['subscription'];

        // Prüfen ob Subscription bereits existiert
        $existingSubscription = $this->pushSubscriptionRepository->findOneBy([
            'user' => $user,
            'endpoint' => $subscriptionData['endpoint']
        ]);

        if ($existingSubscription) {
            return $this->json(['message' => 'Already subscribed']);
        }

        // Neue Subscription erstellen
        $subscription = new PushSubscription();
        $subscription->setUser($user);
        $subscription->setEndpoint($subscriptionData['endpoint']);
        $subscription->setP256dhKey($subscriptionData['keys']['p256dh'] ?? '');
        $subscription->setAuthKey($subscriptionData['keys']['auth'] ?? '');
        $subscription->setCreatedAt(new DateTime());
        $subscription->setIsActive(true);

        $this->entityManager->persist($subscription);
        $this->entityManager->flush();

        return $this->json(['message' => 'Push subscription created successfully']);
    }

    /**
     * Unsubscribe from push notifications.
     */
    #[Route('/unsubscribe', name: 'unsubscribe', methods: ['POST'])]
    public function unsubscribe(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true);

        if (!isset($data['subscription']['endpoint'])) {
            return $this->json(['error' => 'Invalid subscription data'], 400);
        }

        $endpoint = $data['subscription']['endpoint'];

        $subscription = $this->pushSubscriptionRepository->findOneBy([
            'user' => $user,
            'endpoint' => $endpoint
        ]);

        if ($subscription) {
            $this->entityManager->remove($subscription);
            $this->entityManager->flush();
        }

        return $this->json(['message' => 'Push subscription removed successfully']);
    }

    /**
     * Get user's push subscriptions.
     */
    #[Route('/subscriptions', name: 'subscriptions', methods: ['GET'])]
    public function getSubscriptions(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $subscriptions = $this->pushSubscriptionRepository->findBy([
            'user' => $user,
            'isActive' => true
        ]);

        return $this->json([
            'subscriptions' => array_map(fn ($s) => [
                'id' => $s->getId(),
                'endpoint' => $s->getEndpoint(),
                'createdAt' => $s->getCreatedAt()->format('Y-m-d H:i:s')
            ], $subscriptions)
        ]);
    }

    /**
     * Push health check: Returns detailed status about the user's push setup.
     *
     * This endpoint is called periodically by the frontend to detect problems
     * early — before the user notices they haven't received notifications.
     */
    #[Route('/health', name: 'health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        // 1. VAPID configuration check
        $vapidConfigured = (bool) $this->params->get('vapid_public_key');

        // 2. Active subscriptions for this user
        $subscriptions = $this->pushSubscriptionRepository->findBy([
            'user' => $user,
            'isActive' => true,
        ]);
        $subscriptionCount = count($subscriptions);

        // 3. Recent notification delivery statistics (last 7 days)
        $recentStats = $this->notificationRepository->getPushDeliveryStats($user, 7);

        $statsWindowStart = (new DateTime())->sub(new DateInterval('P7D'));
        $lastPushSuccessAt = $user->getLastPushSuccessAt();
        $lastPushFailureAt = $user->getLastPushFailureAt();
        $hasRecentPushSuccess = null !== $lastPushSuccessAt && $lastPushSuccessAt >= $statsWindowStart;
        $hasRecentPushFailure = null !== $lastPushFailureAt && $lastPushFailureAt >= $statsWindowStart;
        $hasRecoveredPushDelivery = $hasRecentPushSuccess;
        $hasEnoughDeliverySamples = $recentStats['total'] >= 3;

        // 4. Last successfully sent notification
        $lastSentAt = $lastPushSuccessAt?->format('c');
        if (null === $lastSentAt) {
            $lastSentNotification = $this->notificationRepository->findLastSentForUser($user);
            $lastSentAt = $lastSentNotification?->getCreatedAt()?->format('c');
        }

        // 5. Unsent notifications count (stuck notifications = problem indicator)
        $unsentCount = count($this->notificationRepository->findUnsentByUser($user));

        // Build status assessment
        $issues = [];
        if (!$vapidConfigured) {
            $issues[] = 'vapid_not_configured';
        }
        if (0 === $subscriptionCount) {
            $issues[] = 'no_subscriptions';
        }
        if ($recentStats['total'] > 0 && 0 === $recentStats['sent']) {
            $issues[] = ($hasRecoveredPushDelivery || !$hasEnoughDeliverySamples)
                ? 'notification_queue_stuck'
                : 'all_deliveries_failed';
        }
        if ($unsentCount > 5) {
            $issues[] = 'many_unsent_stuck';
        }
        if ($hasEnoughDeliverySamples && $recentStats['failRate'] > 50 && !$hasRecoveredPushDelivery) {
            $issues[] = 'high_failure_rate';
        }

        $status = 0 === count($issues) ? 'healthy' : 'degraded';
        if (in_array('vapid_not_configured', $issues, true) || in_array('no_subscriptions', $issues, true)) {
            $status = 'broken';
        }

        return $this->json([
            'status' => $status,
            'issues' => $issues,
            'vapidConfigured' => $vapidConfigured,
            'subscriptionCount' => $subscriptionCount,
            'recentStats' => $recentStats,
            'lastSentAt' => $lastSentAt,
            'unsentCount' => $unsentCount,
        ]);
    }

    /**
     * Send a test push to the current user to verify the entire pipeline works.
     */
    #[Route('/test', name: 'test', methods: ['POST'])]
    public function sendTestPush(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $subscriptions = $this->pushSubscriptionRepository->findBy([
            'user' => $user,
            'isActive' => true,
        ]);

        if (0 === count($subscriptions)) {
            return $this->json([
                'success' => false,
                'error' => 'no_subscriptions',
                'message' => 'Keine aktiven Push-Subscriptions gefunden. Bitte Push-Benachrichtigungen im Browser erlauben.',
            ], 400);
        }

        try {
            $this->pushNotificationService->sendNotification(
                $user,
                '🔔 Test-Benachrichtigung',
                'Wenn du das siehst, funktionieren deine Push-Benachrichtigungen einwandfrei!',
                '/profile'
            );

            return $this->json([
                'success' => true,
                'message' => 'Test-Push wurde gesendet! Du solltest sie in wenigen Sekunden erhalten.',
                'subscriptionCount' => count($subscriptions),
            ]);
        } catch (Throwable $e) {
            return $this->json([
                'success' => false,
                'error' => 'send_failed',
                'message' => 'Push konnte nicht gesendet werden: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get push notification preferences for the current user.
     *
     * Returns a map of category => enabled (bool). Missing entries default to true.
     */
    #[Route('/preferences', name: 'preferences_get', methods: ['GET'])]
    public function getPreferences(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json([
            'preferences' => $user->getNotificationPreferences() ?? [],
        ]);
    }

    /**
     * Save push notification preferences for the current user.
     *
     * Expects JSON body: { "preferences": { "news": true, "message": false, ... } }
     */
    #[Route('/preferences', name: 'preferences_put', methods: ['PUT'])]
    public function savePreferences(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        if (!isset($data['preferences']) || !is_array($data['preferences'])) {
            return $this->json(['error' => 'Invalid data'], 400);
        }

        // Only allow known category keys, cast values to bool
        $allowed = [
            'news', 'message', 'participation', 'event_cancelled',
            'event_reactivated', 'team_ride', 'team_ride_booking',
            'feedback', 'survey', 'system',
        ];

        $sanitised = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $data['preferences'])) {
                $sanitised[$key] = (bool) $data['preferences'][$key];
            }
        }

        $user->setNotificationPreferences($sanitised);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'preferences' => $sanitised]);
    }
}
