<?php

namespace App\Controller;

use App\Entity\Club;
use App\Entity\News;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\NewsRepository;
use App\Security\Voter\NewsVoter;
use App\Service\NotificationService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route(path: '/news', name: 'app_news_')]
class NewsController extends AbstractController
{
    private EntityManagerInterface $em;
    private NewsRepository $newsRepository;

    public function __construct(
        EntityManagerInterface $em,
        private NotificationService $notificationService
    ) {
        $this->em = $em;
        $repository = $em->getRepository(News::class);
        assert($repository instanceof NewsRepository);
        $this->newsRepository = $repository;
    }

    #[Route(path: '', name: 'app_news_list', methods: ['GET'])]
    public function index(): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        // News für User - ohne Limit für die Übersicht
        $news = $this->newsRepository->findForUser($user, null);
        $newsArr = array_map(function (News $n) {
            $createdByUser = $n->getCreatedBy();

            return [
                'id' => $n->getId(),
                'title' => $n->getTitle(),
                'content' => $n->getContent(),
                'createdAt' => $n->getCreatedAt()->format('c'),
                'createdByUserId' => $n->getCreatedBy()->getId(),
                'createdByUserName' => trim($createdByUser->getFirstName() . ' ' . $createdByUser->getLastName()),
                'visibility' => $n->getVisibility(),
                'club' => $n->getClub()?->getId(),
                'team' => $n->getTeam()?->getId(),
            ];
        }, $news);

        // Clubs & Teams für Auswahl
        $clubs = [];
        $teams = [];
        if (in_array('ROLE_ADMIN', $user->getRoles(), true) || in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            $allClubs = $this->em->getRepository(Club::class)->findAll();
            foreach ($allClubs as $club) {
                $clubs[] = [
                    'id' => $club->getId(),
                    'name' => $club->getName(),
                ];
            }
            $allTeams = $this->em->getRepository(Team::class)->findAll();
            foreach ($allTeams as $team) {
                $teams[] = [
                    'id' => $team->getId(),
                    'name' => $team->getName(),
                ];
            }
        } else {
            foreach ($user->getUserRelations() as $relation) {
                if ($relation->getPlayer()) {
                    foreach ($relation->getPlayer()->getPlayerTeamAssignments() as $pta) {
                        $team = $pta->getTeam();
                        $teams[] = [
                            'id' => $team->getId(),
                            'name' => $team->getName(),
                        ];
                    }
                    foreach ($relation->getPlayer()->getPlayerClubAssignments() as $pca) {
                        $club = $pca->getClub();
                        $clubs[] = [
                            'id' => $club->getId(),
                            'name' => $club->getName(),
                        ];
                    }
                }
                if ($relation->getCoach()) {
                    foreach ($relation->getCoach()->getCoachTeamAssignments() as $cta) {
                        $team = $cta->getTeam();
                        $teams[] = [
                            'id' => $team->getId(),
                            'name' => $team->getName(),
                        ];
                    }
                    foreach ($relation->getCoach()->getCoachClubAssignments() as $cca) {
                        $club = $cca->getClub();
                        $clubs[] = [
                            'id' => $club->getId(),
                            'name' => $club->getName(),
                        ];
                    }
                }
            }
        }

        $visibilityOptions = [
            ['label' => 'Platform', 'value' => 'platform'],
            ['label' => 'Club', 'value' => 'club'],
            ['label' => 'Team', 'value' => 'team'],
        ];

        // Prüfe ob der Benutzer News erstellen darf
        $canCreate = $this->isGranted(NewsVoter::CREATE, new News());

        return new JsonResponse([
            'news' => $newsArr,
            'clubs' => $clubs,
            'teams' => $teams,
            'visibilityOptions' => $visibilityOptions,
            'canCreate' => $canCreate,
        ]);
    }

    #[Route(path: '/{id}', name: 'app_news_show', methods: ['GET'])]
    public function show(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $news = $this->newsRepository->find($id);
        if (!$news) {
            return new JsonResponse(['error' => 'Diese Nachricht wurde nicht gefunden oder ist nicht mehr verfügbar.'], 404);
        }

        // Check if user has access to this news based on visibility
        if (!$this->isGranted(NewsVoter::VIEW, $news)) {
            return new JsonResponse(['error' => 'Sie haben keine Berechtigung, diese Nachricht anzuzeigen.'], 403);
        }

        $createdByUser = $news->getCreatedBy();

        return new JsonResponse([
            'id' => $news->getId(),
            'title' => $news->getTitle(),
            'content' => $news->getContent(),
            'createdAt' => $news->getCreatedAt()->format('c'),
            'createdByUserId' => $createdByUser->getId(),
            'createdByUserName' => trim($createdByUser->getFirstName() . ' ' . $createdByUser->getLastName()),
            'visibility' => $news->getVisibility(),
            'club' => $news->getClub()?->getId(),
            'team' => $news->getTeam()?->getId(),
        ]);
    }

    #[Route(path: '/create', name: 'app_news_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $news = new News();

        if (!$this->isGranted(NewsVoter::CREATE, $news)) {
            return new JsonResponse(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Invalid JSON'], 400);
        }
        $title = $data['title'] ?? null;
        $content = $data['content'] ?? null;
        $visibility = $data['visibility'] ?? null;
        $club = null;
        $team = null;

        // Platform-News nur für ROLE_SUPERADMIN
        if ('platform' === $visibility && !in_array('ROLE_SUPERADMIN', $user->getRoles(), true)) {
            return new JsonResponse(['error' => 'Nur Systemadministratoren dürfen Platform-News erstellen.'], 403);
        }

        if ('club' === $visibility && !empty($data['club_id'])) {
            $club = $this->em->getRepository(Club::class)->find($data['club_id']);
        }
        if ('team' === $visibility && !empty($data['team_id'])) {
            $team = $this->em->getRepository(Team::class)->find($data['team_id']);
        }
        if (!$title || !$content || !$visibility) {
            return new JsonResponse(['error' => 'Missing required fields'], 400);
        }
        $news->setTitle($title)
            ->setContent($content)
            ->setVisibility($visibility)
            ->setCreatedBy($user)
            ->setCreatedAt(new DateTimeImmutable())
            ->setClub($club)
            ->setTeam($team);
        $this->em->persist($news);
        $this->em->flush();

        $this->createNewsNotifications($news);

        return new JsonResponse(['success' => true, 'id' => $news->getId()]);
    }

    /**
     * Create notifications for users based on news visibility.
     */
    private function createNewsNotifications(News $news): void
    {
        $users = [];

        switch ($news->getVisibility()) {
            case 'platform':
                // Notify all users
                $users = $this->em->getRepository(User::class)->findAll();
                break;

            case 'club':
                if ($news->getClub()) {
                    // Find all users related to this club
                    $users = $this->retrieveUsersByClub($news->getClub());
                }
                break;

            case 'team':
                if ($news->getTeam()) {
                    // Find all users related to this team
                    $users = $this->retrieveUsersByTeam($news->getTeam());
                }
                break;
        }

        // Create notifications for all relevant users (except the author)
        $filteredUsers = array_filter($users, function (User $user) use ($news) {
            return $user->getId() !== $news->getCreatedBy()->getId();
        });

        if (!empty($filteredUsers)) {
            $preview = self::buildNotificationPreview((string) $news->getContent());

            $this->notificationService->createNotificationForUsers(
                $filteredUsers,
                'news',
                'Neue Nachricht: ' . $news->getTitle(),
                $preview,
                ['newsId' => $news->getId(), 'url' => '/news/' . $news->getId()]
            );
        }
    }

    /**
     * Get users related to a club.
     *
     * @return User[]
     */
    private function retrieveUsersByClub(Club $club): array
    {
        $users = [];

        // Get users through UserRelations that have players in this club
        $userRelations = $this->em->getRepository(UserRelation::class)
            ->createQueryBuilder('ur')
            ->join('ur.player', 'p')
            ->join('p.playerClubAssignments', 'pca')
            ->where('pca.club = :club')
            ->setParameter('club', $club)
            ->getQuery()
            ->getResult();

        foreach ($userRelations as $relation) {
            $users[] = $relation->getUser();
        }

        // Get users through UserRelations that have coaches in this club
        $coachRelations = $this->em->getRepository(UserRelation::class)
            ->createQueryBuilder('ur')
            ->join('ur.coach', 'c')
            ->join('c.coachClubAssignments', 'cca')
            ->where('cca.club = :club')
            ->setParameter('club', $club)
            ->getQuery()
            ->getResult();

        foreach ($coachRelations as $relation) {
            $users[] = $relation->getUser();
        }

        return array_unique($users);
    }

    /**
     * Get users related to a team.
     *
     * @return User[]
     */
    private function retrieveUsersByTeam(Team $team): array
    {
        $users = [];

        // Get users through UserRelations that have players in this team
        $userRelations = $this->em->getRepository(UserRelation::class)
            ->createQueryBuilder('ur')
            ->join('ur.player', 'p')
            ->join('p.playerTeamAssignments', 'pta')
            ->where('pta.team = :team')
            ->setParameter('team', $team)
            ->getQuery()
            ->getResult();

        foreach ($userRelations as $relation) {
            $users[] = $relation->getUser();
        }

        // Get users through UserRelations that have coaches in this team
        $coachRelations = $this->em->getRepository(UserRelation::class)
            ->createQueryBuilder('ur')
            ->join('ur.coach', 'c')
            ->join('c.coachTeamAssignments', 'cta')
            ->where('cta.team = :team')
            ->setParameter('team', $team)
            ->getQuery()
            ->getResult();

        foreach ($coachRelations as $relation) {
            $users[] = $relation->getUser();
        }

        return array_unique($users);
    }

    #[Route(path: '/{id}/edit', name: 'app_news_edit', methods: ['POST'])]
    public function edit(int $id, Request $request): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $news = $this->newsRepository->find($id);
        if (!$news) {
            return new JsonResponse(['error' => 'Not found'], 404);
        }
        if (!$this->isGranted(NewsVoter::EDIT, $news)) {
            return new JsonResponse(['error' => 'Forbidden'], 403);
        }
        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return new JsonResponse(['error' => 'Invalid JSON'], 400);
        }
        $title = $data['title'] ?? null;
        $content = $data['content'] ?? null;
        if (!$title || !$content) {
            return new JsonResponse(['error' => 'Missing required fields'], 400);
        }
        $news->setTitle($title);
        $news->setContent($content);
        $this->em->flush();

        return new JsonResponse(['success' => true]);
    }

    #[Route(path: '/{id}/delete', name: 'app_news_delete', methods: ['POST'])]
    public function delete(int $id): JsonResponse
    {
        /** @var ?User $user */
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }
        $news = $this->newsRepository->find($id);
        if (!$news) {
            return new JsonResponse(['error' => 'Not found'], 404);
        }
        if (!$this->isGranted(NewsVoter::DELETE, $news)) {
            return new JsonResponse(['error' => 'Forbidden'], 403);
        }

        // Delete all notifications related to this news
        $connection = $this->em->getConnection();
        $connection->executeStatement(
            'DELETE FROM notifications WHERE JSON_EXTRACT(data, "$.newsId") = :newsId',
            ['newsId' => $news->getId()]
        );

        $this->em->remove($news);
        $this->em->flush();

        return new JsonResponse(['success' => true]);
    }

    /**
     * Convert HTML news content to a clean plain-text preview for push notifications.
     *
     * Block-level closing tags are replaced with a space before stripping HTML,
     * preventing words from concatenating across element boundaries.
     * The result is truncated at a word boundary around 120 characters.
     */
    public static function buildNotificationPreview(string $html): string
    {
        // Block-closing tags → space so adjacent words don't concatenate
        $html = (string) preg_replace('/<\/(p|h[1-6]|li|blockquote|div|td|th|tr)>/i', ' ', $html);
        $html = (string) preg_replace('/<br\s*\/?>/i', ' ', $html);
        $plainContent = trim((string) preg_replace('/\s+/', ' ', strip_tags($html)));

        if (mb_strlen($plainContent) > 120) {
            $truncated = mb_substr($plainContent, 0, 120);
            // Step back to last space to avoid cutting mid-word
            $lastSpace = mb_strrpos($truncated, ' ');
            if (false !== $lastSpace && $lastSpace > 80) {
                $truncated = mb_substr($truncated, 0, $lastSpace);
            }

            return $truncated . '…';
        }

        return $plainContent;
    }
}
