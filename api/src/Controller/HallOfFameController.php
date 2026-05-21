<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\PlayerTitle;
use App\Entity\User;
use App\Entity\UserLevel;
use App\Entity\UserRelation;
use App\Service\UserTitleService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/public')]
final class HallOfFameController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private UserTitleService $userTitleService,
    ) {
    }

    #[Route('/hall-of-fame', name: 'api_public_hall_of_fame', methods: ['GET'])]
    public function index(): JsonResponse
    {
        $topLevel = $this->getTopLevel();
        $titles = $this->getTitleHolders();

        return $this->json([
            'topLevel' => $topLevel,
            'titles' => $titles,
        ]);
    }

    /**
     * Returns the top 20 users by level who have opted in.
     *
     * @return array<int, array<string, mixed>>
     */
    private function getTopLevel(): array
    {
        $qb = $this->em->createQueryBuilder();

        $subQb = $this->em->createQueryBuilder()
            ->select('1')
            ->from(UserRelation::class, 'ur')
            ->join('ur.relationType', 'rt')
            ->where('ur.user = u')
            ->andWhere('rt.identifier IN (:allowedTypes)');

        /** @var array<int, array<string, mixed>> $rows */
        $rows = $qb
            ->select(
                'u.id',
                'u.firstName',
                'u.lastName',
                'u.avatarFilename',
                'ul.level',
                'ul.xpTotal',
            )
            ->from(User::class, 'u')
            ->join(UserLevel::class, 'ul', 'WITH', 'ul.user = u')
            ->where('u.showInHallOfFame = true')
            ->andWhere('ul.level > 0')
            ->andWhere($qb->expr()->exists($subQb->getDQL()))
            ->setParameter('allowedTypes', ['self_player', 'self_coach'])
            ->orderBy('ul.level', 'DESC')
            ->addOrderBy('ul.xpTotal', 'DESC')
            ->setMaxResults(20)
            ->getQuery()
            ->getArrayResult();

        $userIds = array_column($rows, 'id');
        $users = $this->em->getRepository(User::class)->findBy(['id' => $userIds]);
        $titleMap = [];
        foreach ($users as $user) {
            $td = $this->userTitleService->retrieveTitleDataForUser($user);
            $titleMap[$user->getId()] = ['hasTitle' => $td['hasTitle'], 'avatarFrame' => $td['avatarFrame']];
        }
        foreach ($rows as &$row) {
            $row['titleObj'] = $titleMap[$row['id']] ?? ['hasTitle' => false, 'avatarFrame' => null];
        }
        unset($row);

        return $rows;
    }

    /**
     * Returns all active titles whose player is linked to a user that has opted in.
     *
     * @return array<int, array<string, mixed>>
     */
    private function getTitleHolders(): array
    {
        /** @var array<int, array<string, mixed>> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select(
                'pt.id',
                'pt.titleCategory',
                'pt.titleScope',
                'pt.titleRank',
                'pt.value',
                'pt.season',
                'p.firstName AS playerFirstName',
                'p.lastName  AS playerLastName',
                'u.id        AS userId',
                'u.avatarFilename',
                't.name      AS teamName',
                'l.name      AS leagueName',
                'c.name      AS cupName',
            )
            ->from(PlayerTitle::class, 'pt')
            ->join('pt.player', 'p')
            ->join('p.userRelations', 'ur')
            ->join('ur.user', 'u')
            ->join('ur.relationType', 'rt')
            ->leftJoin('pt.team', 't')
            ->leftJoin('pt.league', 'l')
            ->leftJoin('pt.cup', 'c')
            ->where('pt.isActive = true')
            ->andWhere('rt.identifier = :selfType')
            ->andWhere('u.showInHallOfFame = true')
            ->setParameter('selfType', 'self_player')
            ->getQuery()
            ->getArrayResult();

        foreach ($rows as &$row) {
            $row['titleObj'] = [
                'hasTitle' => true,
                'avatarFrame' => sprintf('%s_%s_%s', $row['titleScope'], $row['titleCategory'], $row['titleRank']),
            ];
        }
        unset($row);

        return $rows;
    }
}
