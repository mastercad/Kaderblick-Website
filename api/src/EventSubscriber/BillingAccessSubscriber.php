<?php

declare(strict_types=1);

namespace App\EventSubscriber;

use App\Entity\Team;
use App\Entity\User;
use App\Service\BillingAccessService;
use App\Service\BillingManager;
use App\Service\CoachTeamPlayerService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\KernelEvents;

#[AsEventListener(event: KernelEvents::CONTROLLER, priority: 5)]
final class BillingAccessSubscriber
{
    private const ALLOWED_PATHS = ['/api/about-me', '/api/billing', '/api/notifications', '/api/push', '/api/logout'];

    public function __construct(
        private Security $security,
        private CoachTeamPlayerService $teamService,
        private BillingManager $billing,
        private BillingAccessService $access,
        private EntityManagerInterface $em
    ) {
    }

    public function __invoke(ControllerEvent $event): void
    {
        $user = $this->security->getUser();
        if (!$user instanceof User || in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            return;
        }
        $path = $event->getRequest()->getPathInfo();
        foreach (self::ALLOWED_PATHS as $allowed) {
            if (str_starts_with($path, $allowed)) {
                return;
            }
        }

        $teams = [];
        $linkedContext = $this->teamService->resolveLinkedContext($user);
        $linkedTeams = $linkedContext['linkedTeams'] ?? [];
        foreach (is_array($linkedTeams) ? $linkedTeams : [] as $data) {
            if (isset($data['id'])) {
                $teams[(int) $data['id']] = $data;
            }
        }
        foreach ($this->billing->manageableTeams($user) as $team) {
            $teams[$team->getId()] = $team;
        }
        if ([] === $teams) {
            return;
        }

        $hasAccess = false;
        foreach ($teams as $teamOrData) {
            $team = $teamOrData instanceof Team ? $teamOrData : null;
            if (!$team && isset($teamOrData['id'])) {
                $team = $this->em->getRepository(Team::class)->find((int) $teamOrData['id']);
            }
            if (null === $team) {
                continue;
            }
            if (($this->access->statusFor($team)['access'] ?? true) === true) {
                $hasAccess = true;
                break;
            }
        }
        if ($hasAccess) {
            return;
        }

        $event->setController(static fn () => new JsonResponse([
            'error' => 'billing_access_blocked',
            'message' => 'Der Teamzugang ist wegen zwei offener Abrechnungszeiträume gesperrt.',
            'billingUrl' => '/abrechnung',
        ], 402));
    }
}
