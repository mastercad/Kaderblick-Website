<?php

namespace App\Controller\Api;

use App\Entity\AgeGroup;
use App\Entity\League;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\TeamRepository;
use App\Security\Voter\TeamVoter;
use App\Service\CoachTeamPlayerService;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route(path: '/api/teams', name: 'api_teams_')]
#[IsGranted('IS_AUTHENTICATED')]
class TeamsController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private CoachTeamPlayerService $coachTeamPlayerService
    ) {
    }

    /**
     * Supported contexts via ?context= query parameter:
     *   (none)       – default: only teams the authenticated user is assigned to
     *   match        – all teams; only effective for coaches, admins and superadmins
     *   tournament   – identical to "match"
     * Regular users (e.g. parents) are always filtered to their own teams,
     * regardless of the context parameter.
     */
    #[Route('/list', name: 'api_teams_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        /** @var TeamRepository $teamsRepository */
        $teamsRepository = $this->entityManager->getRepository(Team::class);

        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $coachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($user));
        $isCoach = count($coachTeamIds) > 0;

        // Only coaches, admins and superadmins may bypass the user-assignment filter.
        // Regular users (e.g. parents) must never see all teams just by passing a context.
        $context = $request->query->get('context', '');
        $allTeams = in_array($context, ['match', 'tournament'], true) && ($isAdmin || $isCoach);

        /** @var Team[] $teams */
        $teams = $teamsRepository->fetchOptimizedList($user, $allTeams);

        return $this->json([
            'teams' => array_map(fn ($team) => [
                'id' => $team['id'],
                'name' => $team['name'],
                'ageGroup' => [
                    'id' => $team['age_group_id'],
                    'name' => $team['age_group_name'],
                ],
                'league' => [
                    'id' => $team['league_id'],
                    'name' => $team['league_name'],
                ],
                'defaultHalfDuration' => isset($team['default_half_duration']) ? (int) $team['default_half_duration'] : null,
                'defaultHalftimeBreakDuration' => isset($team['default_halftime_break_duration']) ? (int) $team['default_halftime_break_duration'] : null,
                'bannerImage' => $team['banner_image'] ?? null,
                'permissions' => [
                    'canView' => true,
                    'canEdit' => $isAdmin || in_array($team['id'], $coachTeamIds),
                    'canDelete' => $isAdmin || in_array($team['id'], $coachTeamIds),
                    'canCreate' => $isAdmin,
                    'canEditBanner' => $isAdmin,
                ]
            ], $teams)
        ]);
    }

    #[Route('', name: 'api_teams_index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 25)));
        $search = trim((string) $request->query->get('search', ''));

        // Season metadata
        $seasonParam = $request->query->get('season');
        $now = new DateTimeImmutable();
        $currentMonth = (int) $now->format('n');
        $currentYear = (int) $now->format('Y');
        $defaultSeasonYear = $currentMonth >= 7 ? $currentYear : ($currentYear - 1);
        $seasonYear = (null !== $seasonParam && ctype_digit((string) $seasonParam))
            ? (int) $seasonParam
            : $defaultSeasonYear;
        $availableSeasons = [];
        for ($y = 2021; $y <= $defaultSeasonYear; ++$y) {
            $availableSeasons[] = $y;
        }

        /** @var User $user */
        $user = $this->getUser();
        /** @var TeamRepository $teamsRepository */
        $teamsRepository = $this->entityManager->getRepository(Team::class);
        $result = $teamsRepository->fetchPaginatedList($user, $search, $page, $limit);

        $isAdmin = $this->isGranted('ROLE_ADMIN', $user) || $this->isGranted('ROLE_SUPERADMIN', $user);
        $coachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($user));

        return $this->json([
            'teams' => array_map(fn ($team) => [
                'id' => $team['id'],
                'name' => $team['name'],
                'ageGroup' => [
                    'id' => $team['age_group_id'],
                    'name' => $team['age_group_name'],
                ],
                'league' => [
                    'id' => $team['league_id'],
                    'name' => $team['league_name'],
                ],
                'bannerImage' => $team['banner_image'] ?? null,
                'permissions' => [
                    'canView' => true,
                    'canEdit' => $isAdmin || in_array($team['id'], $coachTeamIds),
                    'canDelete' => $isAdmin || in_array($team['id'], $coachTeamIds),
                    'canCreate' => $isAdmin,
                    'canEditBanner' => $isAdmin,
                ]
            ], $result['data']),
            'total' => $result['total'],
            'page' => $page,
            'limit' => $limit,
            'availableSeasons' => $availableSeasons,
            'selectedSeason' => $seasonYear,
        ]);
    }

    #[Route('/{id}/details', name: 'api_team_show', methods: ['GET'])]
    public function show(Team $team): JsonResponse
    {
        if (!$this->isGranted(TeamVoter::VIEW, $team)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        /** @var User $user */
        $user = $this->getUser();

        return $this->json([
            'team' => [
                'id' => $team->getId(),
                'name' => $team->getName(),
                'ageGroup' => [
                    'id' => $team->getAgeGroup()->getId(),
                    'name' => $team->getAgeGroup()->getName(),
                ],
                'league' => [
                    'id' => $team->getLeague()?->getId(),
                    'name' => $team->getLeague()?->getName(),
                ],
                'defaultHalfDuration' => $team->getDefaultHalfDuration(),
                'defaultHalftimeBreakDuration' => $team->getDefaultHalftimeBreakDuration(),
                'fussballDeId' => $team->getFussballDeId(),
                'fussballDeUrl' => $team->getFussballDeUrl(),
                'bannerImage' => $team->getBannerImage(),
                'permissions' => [
                    'canView' => $this->isGranted(TeamVoter::VIEW, $team),
                    'canEdit' => $this->isGranted(TeamVoter::EDIT, $team),
                    'canDelete' => $this->isGranted(TeamVoter::DELETE, $team),
                    'canCreate' => $this->isGranted(TeamVoter::CREATE, $team),
                    'canEditBanner' => $this->canEditBanner($team),
                ]
            ]
        ]);
    }

    #[Route('/{id}/timing-defaults', name: 'api_team_timing_defaults', methods: ['PATCH'])]
    public function updateTimingDefaults(Team $team, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');
        $coachTeamIds = array_keys($this->coachTeamPlayerService->collectCoachTeams($user));
        $isCoachOfTeam = in_array($team->getId(), $coachTeamIds, true);

        if (!$isAdmin && !$isCoachOfTeam) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true) ?? [];

        if (array_key_exists('defaultHalfDuration', $data)) {
            $val = $data['defaultHalfDuration'];
            $team->setDefaultHalfDuration(null !== $val && '' !== $val ? (int) $val : null);
        }

        if (array_key_exists('defaultHalftimeBreakDuration', $data)) {
            $val = $data['defaultHalftimeBreakDuration'];
            $team->setDefaultHalftimeBreakDuration(null !== $val && '' !== $val ? (int) $val : null);
        }

        $this->entityManager->persist($team);
        $this->entityManager->flush();

        return $this->json([
            'success' => true,
            'defaultHalfDuration' => $team->getDefaultHalfDuration(),
            'defaultHalftimeBreakDuration' => $team->getDefaultHalftimeBreakDuration(),
        ]);
    }

    #[Route('/{id}', name: 'api_team_update', methods: ['PUT'])]
    public function update(Team $team, Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isGranted(TeamVoter::EDIT, $team)) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_FORBIDDEN);
        }

        $teamData = json_decode($request->getContent(), true);

        $team->setName($teamData['name']);

        if (isset($teamData['ageGroup']['id'])) {
            $ageGroupRepository = $this->entityManager->getRepository(AgeGroup::class);
            $ageGroup = $ageGroupRepository->find($teamData['ageGroup']['id']);
            if ($ageGroup) {
                $team->setAgeGroup($ageGroup);
            }
        }

        if (isset($teamData['league']['id'])) {
            $leagueRepository = $this->entityManager->getRepository(League::class);
            $league = $leagueRepository->find($teamData['league']['id']);
            if ($league) {
                $team->setLeague($league);
            }
        }

        if (array_key_exists('defaultHalfDuration', $teamData)) {
            $val = $teamData['defaultHalfDuration'];
            $team->setDefaultHalfDuration(null !== $val && '' !== $val ? (int) $val : null);
        }

        if (array_key_exists('defaultHalftimeBreakDuration', $teamData)) {
            $val = $teamData['defaultHalftimeBreakDuration'];
            $team->setDefaultHalftimeBreakDuration(null !== $val && '' !== $val ? (int) $val : null);
        }

        $this->entityManager->persist($team);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    #[Route('', name: 'api_team_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $teamData = json_decode($request->getContent(), true);

        $team = new Team();

        if (!$this->isGranted(TeamVoter::CREATE, $team)) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_FORBIDDEN);
        }

        $team->setName($teamData['name']);

        if (isset($teamData['ageGroup']['id'])) {
            $ageGroupRepository = $this->entityManager->getRepository(AgeGroup::class);
            $ageGroup = $ageGroupRepository->find($teamData['ageGroup']['id']);
            if ($ageGroup) {
                $team->setAgeGroup($ageGroup);
            }
        }

        if (isset($teamData['league']['id'])) {
            $leagueRepository = $this->entityManager->getRepository(League::class);
            $league = $leagueRepository->find($teamData['league']['id']);
            if ($league) {
                $team->setLeague($league);
            }
        }
        $this->entityManager->persist($team);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/{id}', name: 'api_team_delete', methods: ['DELETE'])]
    public function delete(Team $team): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        if (!$this->isGranted(TeamVoter::DELETE, $team)) {
            return $this->json(['error' => 'Unauthorized'], Response::HTTP_FORBIDDEN);
        }

        $this->entityManager->remove($team);
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/{id}/players', name: 'api_team_players', methods: ['GET'])]
    public function players(Team $team): JsonResponse
    {
        $players = $team->getCurrentPlayers();
        $result = [];
        foreach ($players as $player) {
            $shirtNumber = null;
            foreach ($player->getPlayerTeamAssignments() as $pta) {
                if ($pta->getTeam()->getId() === $team->getId()) {
                    $shirtNumber = $pta->getShirtNumber();
                    break;
                }
            }
            $result[] = [
                'id' => $player->getId(),
                'fullName' => $player->getFirstName() . ' ' . $player->getLastName(),
                'shirtNumber' => $shirtNumber,
            ];
        }

        usort($result, static function (array $a, array $b): int {
            if ($a['shirtNumber'] === $b['shirtNumber']) {
                return strcmp((string) $a['fullName'], (string) $b['fullName']);
            }
            if (null === $a['shirtNumber']) {
                return 1;
            }
            if (null === $b['shirtNumber']) {
                return -1;
            }

            return (int) $a['shirtNumber'] <=> (int) $b['shirtNumber'];
        });

        return $this->json($result);
    }

    #[Route('/{id}/banner', name: 'api_team_upload_banner', methods: ['POST'])]
    public function uploadBanner(Team $team, Request $request): JsonResponse
    {
        if (!$this->canEditBanner($team)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $file = $request->files->get('banner');
        if (!$file instanceof UploadedFile) {
            return $this->json(['error' => 'Kein Bild übermittelt'], Response::HTTP_BAD_REQUEST);
        }

        $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!in_array($file->getMimeType(), $allowedMimes, true)) {
            return $this->json(['error' => 'Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($file->getSize() > 50 * 1024 * 1024) {
            return $this->json(['error' => 'Bild zu groß. Maximal 50 MB erlaubt'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Remove old banner file
        if ($team->getBannerImage()) {
            $oldPath = $this->getParameter('kernel.project_dir') . '/public/uploads/team-banners/' . $team->getBannerImage();
            if (file_exists($oldPath)) {
                unlink($oldPath);
            }
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/team-banners';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = $file->guessExtension() ?? 'jpg';
        $tmpFilename = 'team_' . $team->getId() . '_banner_tmp_' . uniqid('', true) . '.' . $ext;
        $file->move($uploadDir, $tmpFilename);

        // Re-encode as JPEG on the server side (compression + optional downscale).
        // If GD is not available the original file is used as-is.
        $filename = $this->compressBannerAsJpeg($uploadDir, $tmpFilename, $team->getId());

        $team->setBannerImage($filename);
        $this->entityManager->flush();

        return $this->json(['success' => true, 'bannerImage' => $filename]);
    }

    #[Route('/{id}/banner', name: 'api_team_delete_banner', methods: ['DELETE'])]
    public function deleteBanner(Team $team): JsonResponse
    {
        if (!$this->canEditBanner($team)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        if ($team->getBannerImage()) {
            $path = $this->getParameter('kernel.project_dir') . '/public/uploads/team-banners/' . $team->getBannerImage();
            if (file_exists($path)) {
                unlink($path);
            }
            $team->setBannerImage(null);
            $this->entityManager->flush();
        }

        return $this->json(['success' => true]);
    }

    /**
     * Re-encodes the uploaded banner as JPEG (quality 88, max 2 400 px wide) via GD.
     * Returns the final filename (JPEG) or the original filename if GD is unavailable.
     */
    private function compressBannerAsJpeg(string $uploadDir, string $srcFilename, int $teamId): string
    {
        if (!function_exists('imagecreatefromjpeg')) {
            return $srcFilename;
        }

        $srcPath = $uploadDir . '/' . $srcFilename;
        $mime = mime_content_type($srcPath) ?: 'image/jpeg';

        $image = match (true) {
            str_contains($mime, 'jpeg') || str_contains($mime, 'jpg') => @imagecreatefromjpeg($srcPath),
            str_contains($mime, 'png') => @imagecreatefrompng($srcPath),
            str_contains($mime, 'webp') => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($srcPath) : false,
            default => false,
        };

        if (false === $image) {
            return $srcFilename;
        }

        // Downscale if wider than 2 400 px
        $w = imagesx($image);
        $h = imagesy($image);
        $maxW = 2400;

        if ($w > $maxW) {
            $newH = (int) round($h * $maxW / $w);
            $scaled = imagescale($image, $maxW, $newH, IMG_BILINEAR_FIXED);
            imagedestroy($image);
            if (false === $scaled) {
                return $srcFilename;
            }
            $image = $scaled;
        }

        $jpgFilename = 'team_' . $teamId . '_banner_' . uniqid('', true) . '.jpg';
        $jpgPath = $uploadDir . '/' . $jpgFilename;

        if (!imagejpeg($image, $jpgPath, 88)) {
            imagedestroy($image);

            return $srcFilename;
        }

        imagedestroy($image);

        if ($srcPath !== $jpgPath && file_exists($srcPath)) {
            unlink($srcPath);
        }

        return $jpgFilename;
    }

    private function canEditBanner(Team $team): bool
    {
        /** @var User|null $user */
        $user = $this->getUser();

        if (!$user instanceof User) {
            return false;
        }

        $roles = $user->getRoles();

        if (in_array('ROLE_SUPERADMIN', $roles, true) || in_array('ROLE_ADMIN', $roles, true)) {
            return true;
        }

        if (!in_array('ROLE_SUPPORTER', $roles, true)) {
            return false;
        }

        // ROLE_SUPPORTER: must have an active UserRelation to a player/coach in this team
        $teamId = $team->getId();
        foreach ($user->getUserRelations() as $relation) {
            $player = $relation->getPlayer();
            if (null !== $player) {
                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($pta->getTeam()->getId() === $teamId) {
                        return true;
                    }
                }
            }

            $coach = $relation->getCoach();
            if (null !== $coach) {
                foreach ($coach->getCoachTeamAssignments() as $cta) {
                    if ($cta->getTeam()->getId() === $teamId) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
