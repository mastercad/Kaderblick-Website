<?php

namespace App\Controller;

use App\Entity\PushSubscription;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/app/push', name: 'app_push_')]
class PushController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private string $vapidPublicKey
    ) {
    }

    #[Route('/key', name: 'key', methods: ['GET'])]
    public function getKey(): JsonResponse
    {
        return $this->json(['key' => $this->vapidPublicKey]);
    }

    #[Route('/subscribe', name: 'subscribe', methods: ['POST'])]
    public function subscribe(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        /** @var User $user */
        $user = $this->getUser();

        $subscription = $this->em->getRepository(PushSubscription::class)
            ->findOneBy(['user' => $user, 'endpoint' => $data['endpoint']]);

        if (!$subscription instanceof PushSubscription) {
            $subscription = new PushSubscription();
            $subscription->setUser($user);
            $subscription->setEndpoint($data['endpoint']);
        }

        $subscription->setPublicKey($data['keys']['p256dh']);
        $subscription->setAuthToken($data['keys']['auth']);

        $this->em->persist($subscription);
        $this->em->flush();

        return $this->json(['status' => 'success']);
    }
}
