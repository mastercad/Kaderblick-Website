<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Player;
use App\Entity\PlayerTitle;
use App\Entity\User;
use App\Repository\PlayerTitleRepository;

class UserTitleService
{
    public function __construct(
        private PlayerTitleRepository $playerTitleRepository
    ) {
    }

    /**
     * Get the highest priority title for a user
     * This is the title that should be displayed (e.g., for avatar frame).
     */
    public function loadDisplayTitle(Player $player): ?PlayerTitle
    {
        return $this->playerTitleRepository->findHighestPriorityTitleForPlayer($player);
    }

    /**
     * Get the highest priority title for a user
     * This is the title that should be displayed (e.g., for avatar frame).
     */
    public function loadDisplayTitleForUser(User $user): ?PlayerTitle
    {
        return $this->playerTitleRepository->findHighestPriorityTitle($user);
    }

    /**
     * Get all active titles for a user.
     *
     * @return PlayerTitle[]
     */
    public function loadAllTitles(Player $player): array
    {
        return $this->playerTitleRepository->findActiveByPlayer($player);
    }

    /**
     * Get all active titles for a user.
     *
     * @return PlayerTitle[]
     */
    public function loadAllTitlesForUser(User $user): array
    {
        return $this->playerTitleRepository->findActiveByUser($user);
    }

    /**
     * Get title data formatted for frontend.
     *
     * @return array<string, mixed>
     */
    public function retrieveTitleDataForUser(User $user): array
    {
        $displayTitle = $this->loadDisplayTitleForUser($user);

        if (!$displayTitle) {
            return [
                'hasTitle' => false,
                'displayTitle' => null,
                'avatarFrame' => null,
                'allTitles' => [],
            ];
        }

        return [
            'hasTitle' => true,
            'displayTitle' => $this->formatTitle($displayTitle),
            'avatarFrame' => $this->retrieveAvatarFrameIdentifier($displayTitle),
            'allTitles' => array_map(
                fn (PlayerTitle $title) => $this->formatTitle($title),
                $this->loadAllTitlesForUser($user)
            ),
        ];
    }

    /**
     * Get title data formatted for frontend.
     *
     * @return array<string, mixed>
     */
    public function retrieveTitleDataForPlayer(Player $player): array
    {
        $displayTitle = $this->loadDisplayTitle($player);

        if (!$displayTitle) {
            return [
                'hasTitle' => false,
                'displayTitle' => null,
                'avatarFrame' => null,
                'allTitles' => [],
            ];
        }

        return [
            'hasTitle' => true,
            'displayTitle' => $this->formatTitle($displayTitle),
            'avatarFrame' => $this->retrieveAvatarFrameIdentifier($displayTitle),
            'allTitles' => array_map(
                fn (PlayerTitle $title) => $this->formatTitle($title),
                $this->loadAllTitles($player)
            ),
        ];
    }

    /**
     * Format title for API response.
     *
     * @return array<string, mixed>
     */
    private function formatTitle(PlayerTitle $title): array
    {
        $data = [
            'id' => $title->getId(),
            'category' => $title->getTitleCategory(),
            'scope' => $title->getTitleScope(),
            'rank' => $title->getTitleRank(),
            'value' => $title->getValue(),
            'teamId' => $title->getTeam()?->getId(),
            'teamName' => $title->getTeam()?->getName(),
            'season' => $title->getSeason(),
            'awardedAt' => $title->getAwardedAt()->format('Y-m-d H:i:s'),
            'displayName' => $this->retrieveTitleDisplayName($title),
            'priority' => $title->getPriority(),
        ];

        // League-Infos ergänzen, falls vorhanden
        if ($title->getLeague()) {
            $data['leagueId'] = $title->getLeague()->getId();
            $data['leagueName'] = $title->getLeague()->getName();
        } else {
            $data['leagueId'] = null;
            $data['leagueName'] = null;
        }

        return $data;
    }

    /**
     * Get human-readable title name.
     */
    private function retrieveTitleDisplayName(PlayerTitle $title): string
    {
        $categoryNames = [
            'top_scorer' => 'Torschützenkönig',
            'top_assist' => 'Vorlagenkönig',
        ];

        $categoryName = $categoryNames[$title->getTitleCategory()] ?? $title->getTitleCategory();
        $rank = ucfirst($title->getTitleRank());
        $scope = '';

        if ('team' === $title->getTitleScope() && $title->getTeam()) {
            $categoryName .= " ({$title->getTeam()->getName()})";
            $scope = 'Team';
        } elseif ('league' === $title->getTitleScope() && $title->getLeague()) {
            $categoryName .= " ({$title->getLeague()->getName()})";
            $scope = $title->getLeague()->getName();
        } elseif ('platform' === $title->getTitleScope()) {
            $scope = 'Platform';
        }

        return "{$scope} {$categoryName} - {$rank}";
    }

    /**
     * Get avatar frame identifier for CSS/image selection
     * Format: {scope}_{rank} (e.g., "platform_gold", "team_silver").
     */
    private function retrieveAvatarFrameIdentifier(PlayerTitle $title): string
    {
        return sprintf(
            '%s_%s_%s',
            $title->getTitleScope(),
            $title->getTitleCategory(),
            $title->getTitleRank()
        );
    }

    /**
     * Check if user has a specific title.
     */
    public function hasTitle(Player $player, string $category, string $scope, string $rank): bool
    {
        $titles = $this->loadAllTitles($player);

        foreach ($titles as $title) {
            if (
                $title->getTitleCategory() === $category
                && $title->getTitleScope() === $scope
                && $title->getTitleRank() === $rank
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns grouped title stats for admin overview (category, scope, rank, count).
     *
     * @return array<int, array<string, mixed>>
     */
    public function retrieveTitleStats(): array
    {
        $qb = $this->playerTitleRepository->createQueryBuilder('t');
        $qb->select(
            't.titleCategory, t.titleScope, t.titleRank,' .
            ' team.id as teamId, team.name as teamName,' .
            ' league.id as leagueId, league.name as leagueName,' .
            ' cup.id as cupId, cup.name as cupName'
        )
            ->leftJoin('t.team', 'team')
            ->leftJoin('t.league', 'league')
            ->leftJoin('t.cup', 'cup')
            ->where('t.isActive = true');

        // Filter: Für Liga-Titel nur solche mit gesetzter Liga
        $qb->andWhere('(t.titleScope != :leagueScope OR league.id IS NOT NULL)')
            ->setParameter('leagueScope', 'league');

        // Filter: Für Cup-Titel nur solche mit gesetztem Cup
        $qb->andWhere('(t.titleScope != :cupScope OR cup.id IS NOT NULL)')
            ->setParameter('cupScope', 'cup');

        $qb->groupBy('t.titleCategory, t.titleScope, t.titleRank, team.id, team.name, league.id, league.name, cup.id, cup.name');
        $qb->orderBy('t.titleCategory, t.titleScope, t.titleRank, team.id, league.id, cup.id');

        $raw = $qb->getQuery()->getArrayResult();

        // Hole alle aktiven PlayerTitles für die Detailzählung
        $allActive = $this->playerTitleRepository->createQueryBuilder('pt')
            ->select('pt.titleCategory, pt.titleScope, pt.titleRank, team2.id as teamId, league2.id as leagueId, cup2.id as cupId, pt.id as playerTitleId')
            ->leftJoin('pt.team', 'team2')
            ->leftJoin('pt.league', 'league2')
            ->leftJoin('pt.cup', 'cup2')
            ->where('pt.isActive = true')
            ->getQuery()->getArrayResult();

        // Zähle pro Gruppe die PlayerTitle-Einträge
        $countMap = [];
        foreach ($allActive as $row) {
            $key = $row['titleCategory'] . '|' . $row['titleScope'] . '|' . $row['titleRank']
                . '|' . ($row['teamId'] ?? '') . '|' . ($row['leagueId'] ?? '') . '|' . ($row['cupId'] ?? '');
            $countMap[$key] = ($countMap[$key] ?? 0) + 1;
        }

        // Baue die finale Liste mit userCount
        $result = [];
        foreach ($raw as $row) {
            $key = $row['titleCategory'] . '|' . $row['titleScope'] . '|' . $row['titleRank']
                . '|' . ($row['teamId'] ?? '') . '|' . ($row['leagueId'] ?? '') . '|' . ($row['cupId'] ?? '');
            $row['userCount'] = $countMap[$key] ?? 0;
            $result[] = $row;
        }

        return $result;
    }
}
