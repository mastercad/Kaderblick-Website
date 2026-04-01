<?php

namespace App\Service;

use App\Entity\User;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

class PushNotificationService
{
    private ?WebPush $webPush = null;

    public function __construct(
        private EntityManagerInterface $em,
        private string $vapidPublicKey,
        private string $vapidPrivateKey,
        private ParameterBagInterface $params,
        private LoggerInterface $logger
    ) {
    }

    // Für Tests
    public function setWebPush(WebPush $webPush): void
    {
        $this->webPush = $webPush;
    }

    private function getWebPush(): WebPush
    {
        if (!$this->webPush) {
            $subject = $this->params->get('app.website_url') ?: 'https://kaderblick.de';

            $this->webPush = new WebPush([
                'VAPID' => [
                    'subject' => $subject,
                    'publicKey' => $this->vapidPublicKey,
                    'privateKey' => $this->vapidPrivateKey,
                ],
            ]);

            $this->logger->info('WebPush initialized', [
                'vapid_subject' => $subject,
                'has_public_key' => (bool) $this->vapidPublicKey,
            ]);
        }

        return $this->webPush;
    }

    /**
     * @return array{attempted: int, successful: int, failed: int}
     */
    public function sendNotification(User $user, string $title, string $body, string $url = '/'): array
    {
        $subscriptions = $user->getPushSubscriptions();
        if ($subscriptions->isEmpty()) {
            return [
                'attempted' => 0,
                'successful' => 0,
                'failed' => 0,
            ];
        }

        /** @var WebPush $webPush */
        $webPush = $this->getWebPush();

        $this->logger->info('Sending push notification', [
            'user_id' => $user->getId(),
            'subscriptions_count' => count($subscriptions),
            'title' => $title,
        ]);

        $endpointMap = [];
        $attempted = 0;
        $successful = 0;
        $failed = 0;

        foreach ($subscriptions as $sub) {
            $subscription = Subscription::create([
                'endpoint' => $sub->getEndpoint(),
                'publicKey' => $sub->getPublicKey(),
                'authToken' => $sub->getAuthToken(),
            ]);

            // Keep a map from endpoint => PushSubscription entity so we can
            // remove the DB entity when the subscription is expired.
            $endpointMap[$subscription->getEndpoint()] = $sub;
            ++$attempted;

            $webPush->sendOneNotification(
                $subscription,
                json_encode([
                    'title' => $title,
                    'body' => $body,
                    'url' => $url,
                    'data' => [
                        'url' => $url,
                    ],
                    'icon' => '/images/icon-192.png',
                    'badge' => '/images/icon-192.png',
                    'vibrate' => [200, 100, 200],
                    'actions' => [
                        [
                            'action' => 'details',
                            'title' => 'Details anzeigen'
                        ]
                    ],
                    'tag' => 'notification-' . $user->getId() . '-' . time(),
                    'requireInteraction' => false
                ])
            );
        }

        // Handle send reports
        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getEndpoint();

            $this->logger->info('Push report', [
                'endpoint' => $endpoint,
                'success' => $report->isSuccess(),
                'expired' => $report->isSubscriptionExpired(),
                'reason' => $report->getReason(),
                'response_status' => $report->getResponse()?->getStatusCode(),
                'response_body' => $report->getResponseContent(),
            ]);

            if ($report->isSuccess()) {
                ++$successful;
                continue;
            }

            ++$failed;

            if (!$report->isSuccess()) {
                if ($report->isSubscriptionExpired()) {
                    if (isset($endpointMap[$endpoint])) {
                        $this->logger->info('Removing expired push subscription', ['endpoint' => $endpoint, 'user_id' => $user->getId()]);
                        $this->em->remove($endpointMap[$endpoint]);
                    }
                }
            }
        }

        $now = new DateTime();
        if ($successful > 0) {
            $user->setLastPushSuccessAt($now);

            if (0 === $failed) {
                $user->setLastPushFailureAt(null);
            }
        }

        if (0 === $successful && $failed > 0) {
            $user->setLastPushFailureAt($now);
        }

        $this->em->persist($user);
        $this->em->flush();

        return [
            'attempted' => $attempted,
            'successful' => $successful,
            'failed' => $failed,
        ];
    }
}
