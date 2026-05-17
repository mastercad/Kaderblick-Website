<?php

namespace App\Service;

use App\Entity\User;
use App\Entity\UserLevel;
use App\Repository\XpRuleRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

class XPService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private XpRuleRepository $xpRuleRepository,
    ) {
    }

    /**
     * Returns the XP value for the given action type from the configurable xp_rules table.
     * Falls back to 0 when no enabled rule is found.
     */
    public function retrieveXPForAction(string $action): int
    {
        $rule = $this->xpRuleRepository->findEnabledByActionType($action);

        return null !== $rule ? $rule->getXpValue() : 0;
    }

    public function addXPToUser(User $user, int $xp, bool $flush = true): void
    {
        $connection = $this->entityManager->getConnection();

        $operation = function () use ($user, $xp, $flush): void {
            $userLevel = $user->getUserLevel();

            if (null !== $userLevel) {
                $this->entityManager->lock($userLevel, LockMode::PESSIMISTIC_WRITE);
            } elseif (null !== $user->getId()) {
                // Serialize creation of user_levels row for first-ever XP write.
                $this->entityManager->lock($user, LockMode::PESSIMISTIC_WRITE);
                $this->entityManager->refresh($user);
                $userLevel = $user->getUserLevel();
                if (null !== $userLevel) {
                    $this->entityManager->lock($userLevel, LockMode::PESSIMISTIC_WRITE);
                }
            }

            if (null === $userLevel) {
                $userLevel = new UserLevel();
                $userLevel->setUser($user);
                $userLevel->setXpTotal(0);
                $userLevel->setLevel(1);
                $userLevel->setUpdatedAt(new DateTimeImmutable());
                $user->setUserLevel($userLevel);
                $this->entityManager->persist($userLevel);
            }

            $currentXP = $userLevel->getXpTotal();
            $currentLevel = $userLevel->getLevel();
            // Add XP
            $newXP = $currentXP + $xp;
            $userLevel->setXpTotal($newXP);
            // Check for level up
            $newLevel = $this->retrieveLevelForXP($newXP);
            if ($newLevel > $currentLevel) {
                $userLevel->setLevel($newLevel);
            }
            $userLevel->setUpdatedAt(new DateTimeImmutable());
            $this->entityManager->persist($userLevel);
            if ($flush) {
                $this->entityManager->flush();
            }
        };

        if ($connection->isTransactionActive()) {
            $operation();

            return;
        }

        $connection->transactional(function () use ($operation): void {
            $operation();
        });
    }

    public function addXpForAction(User $user, string $action, ?int $referenceId = null): void
    {
        $xp = $this->retrieveXPForAction($action);
        if ($xp > 0) {
            $this->addXPToUser($user, $xp);
        }
    }

    public function calculateUserXP(User $user): int
    {
        $userLevel = $user->getUserLevel();
        if (null === $userLevel) {
            return 0;
        }

        return $userLevel->getXpTotal();
    }

    public function calculateUserLevel(User $user): int
    {
        $userLevel = $user->getUserLevel();
        if (null === $userLevel) {
            return 1;
        }

        return $userLevel->getLevel();
    }

    public function levelUpUser(User $user): bool
    {
        $currentXP = $this->calculateUserXP($user);
        $currentLevel = $this->calculateUserLevel($user);
        $requiredXP = $this->retrieveXpForLevel($currentLevel + 1);

        if ($currentXP >= $requiredXP) {
            $user->getUserLevel()->setLevel($currentLevel + 1);
            $user->getUserLevel()->setUpdatedAt(new DateTimeImmutable());
            $this->entityManager->persist($user->getUserLevel());
            $this->entityManager->flush();

            return true;
        }

        return false;
    }

    public function retrieveXpForLevel(int $level, int $base = 50, float $exponent = 1.5): int
    {
        return (int) round($base * pow($level, $exponent));
    }

    public function retrieveLevelForXP(int $xp, int $base = 50, float $exponent = 1.5): int
    {
        return (int) floor(pow($xp / $base, 1 / $exponent));
    }
}
