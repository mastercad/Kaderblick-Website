<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\User;
use App\Entity\UserXpEvent;
use App\Entity\XpRule;
use App\Repository\XpRuleRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

class XPRegistrationService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private XpRuleRepository $xpRuleRepository,
    ) {
    }

    /**
     * Register an XP event for a user.
     *
     * Silently skips when:
     *   - No enabled XP rule exists for the action type
     *   - Dedup check blocks a duplicate (cooldown = 0)
     *   - Active cooldown prevents re-award (cooldown > 0)
     *   - Daily or monthly limit reached
     *
     * @param int|null $actionId Unique ID of the related entity (e.g. GameEvent ID).
     *                           Pass null / user->getId() for user-scoped actions without a distinct entity.
     */
    public function registerXpEvent(User $user, string $actionType, ?int $actionId = null): void
    {
        $connection = $this->entityManager->getConnection();

        $connection->transactional(function () use ($user, $actionType, $actionId): void {
            $rule = $this->xpRuleRepository->findEnabledByActionType($actionType);
            if (null === $rule) {
                return; // Unknown or disabled action — skip silently
            }

            $this->lockUserForXpRegistration($user);

            $repo = $this->entityManager->getRepository(UserXpEvent::class);
            $now = new DateTimeImmutable();

            $cooldown = $rule->getCooldownMinutes();

            if (XpRule::COOLDOWN_DEDUP === $cooldown) {
                // ── Strict dedup: once per (user, actionType, actionId) ─────────────
                // Use a locking read (SELECT … FOR UPDATE) to force a current read
                // under MySQL REPEATABLE READ — snapshot reads would miss rows committed
                // by concurrent transactions after this transaction's snapshot was taken.
                $existing = $repo->createQueryBuilder('e')
                    ->where('e.user = :user')
                    ->andWhere('e.actionType = :actionType')
                    ->andWhere('e.actionId = :actionId')
                    ->setParameter('user', $user)
                    ->setParameter('actionType', $actionType)
                    ->setParameter('actionId', $actionId)
                    ->getQuery()
                    ->setLockMode(LockMode::PESSIMISTIC_WRITE)
                    ->getOneOrNullResult();
                if (null !== $existing) {
                    return;
                }
            } elseif ($cooldown > 0) {
                // ── Time-based cooldown per (user, actionType, actionId) ─────────────
                $since = $now->modify('-' . $cooldown . ' minutes');
                $result = $repo->createQueryBuilder('e')
                    ->select('COUNT(e.id)')
                    ->where('e.user = :user')
                    ->andWhere('e.actionType = :type')
                    ->andWhere('e.actionId = :aid')
                    ->andWhere('e.createdAt > :since')
                    ->setParameter('user', $user)
                    ->setParameter('type', $actionType)
                    ->setParameter('aid', $actionId)
                    ->setParameter('since', $since)
                    ->getQuery()
                    ->getSingleScalarResult();
                if ((int) $result > 0) {
                    return;
                }
            }
            // cooldown = -1 → no dedup at all, rely on limits below

            // ── Daily limit ────────────────────────────────────────────────────────
            if (null !== $rule->getDailyLimit()) {
                $today = new DateTimeImmutable('today midnight');
                $count = (int) $repo->createQueryBuilder('e')
                    ->select('COUNT(e.id)')
                    ->where('e.user = :user')
                    ->andWhere('e.actionType = :type')
                    ->andWhere('e.createdAt >= :today')
                    ->setParameter('user', $user)
                    ->setParameter('type', $actionType)
                    ->setParameter('today', $today)
                    ->getQuery()
                    ->getSingleScalarResult();
                if ($count >= $rule->getDailyLimit()) {
                    return;
                }
            }

            // ── Monthly limit ──────────────────────────────────────────────────────
            if (null !== $rule->getMonthlyLimit()) {
                $monthStart = new DateTimeImmutable('first day of this month midnight');
                $count = (int) $repo->createQueryBuilder('e')
                    ->select('COUNT(e.id)')
                    ->where('e.user = :user')
                    ->andWhere('e.actionType = :type')
                    ->andWhere('e.createdAt >= :monthStart')
                    ->setParameter('user', $user)
                    ->setParameter('type', $actionType)
                    ->setParameter('monthStart', $monthStart)
                    ->getQuery()
                    ->getSingleScalarResult();
                if ($count >= $rule->getMonthlyLimit()) {
                    return;
                }
            }

            // ── Persist the event ─────────────────────────────────────────────────
            $xpEvent = new UserXpEvent();
            $xpEvent->setUser($user);
            $xpEvent->setActionType($actionType);
            $xpEvent->setActionId($actionId);
            $xpEvent->setXpValue($rule->getXpValue());
            $xpEvent->setIsProcessed(false);
            $xpEvent->setCreatedAt($now);

            $this->entityManager->persist($xpEvent);
            $this->entityManager->flush();
        });
    }

    private function lockUserForXpRegistration(User $user): void
    {
        if (null === $user->getId()) {
            return;
        }

        $this->entityManager->lock($user, LockMode::PESSIMISTIC_WRITE);
    }
}
