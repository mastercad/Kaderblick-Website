<?php

namespace App\Controller\Api;

use App\Entity\SupporterRequest;
use App\Entity\Team;
use App\Entity\User;
use App\Repository\SupporterRequestRepository;
use App\Service\SupporterRequestNotificationService;
use App\Service\SupporterScopeService;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api/supporter-request', name: 'api_supporter_request_')]
class SupporterRequestController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private SupporterRequestNotificationService $notificationService,
        private SupporterRequestRepository $supporterRequestRepository,
        private SupporterScopeService $supporterScopeService,
    ) {
    }

    #[Route('', name: 'submit', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function submit(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        $data = json_decode($request->getContent(), true);
        $teamId = (int) ($data['teamId'] ?? 0);
        $team = $teamId > 0 ? $this->em->getRepository(Team::class)->find($teamId) : null;
        if (!$team instanceof Team) {
            return $this->json(['error' => 'Bitte wähle ein Team für die Supporter-Anfrage aus.'], 400);
        }

        $eligibleTeams = $this->getEligibleTeams($user);
        if (!isset($eligibleTeams[$team->getId()])) {
            return $this->json(['error' => 'Du kannst Supporter-Rechte nur für Teams anfragen, denen du zugeordnet bist.'], 403);
        }

        if ($this->supporterScopeService->canSupportTeam($user, $team)) {
            return $this->json(['error' => 'Du hast bereits Supporter-Rechte für dieses Team.'], 409);
        }

        $existing = $this->supporterRequestRepository->findOneByUserAndTeamPending($user->getId(), $team->getId());
        if ($existing) {
            return $this->json([
                'error' => 'Du hast bereits eine offene Supporter-Anfrage für dieses Team. Bitte warte auf die Bearbeitung durch einen Administrator.'
            ], 409);
        }

        $note = isset($data['note']) ? trim((string) $data['note']) : null;

        $supporterRequest = new SupporterRequest();
        $supporterRequest->setUser($user)
            ->setTeam($team)
            ->setNote($note ?: null);

        $this->em->persist($supporterRequest);
        $this->em->flush();

        try {
            $this->notificationService->notifyAdminsAboutNewRequest($supporterRequest);
        } catch (Throwable) {
        }

        return $this->json([
            'message' => 'Deine Supporter-Anfrage wurde erfolgreich eingereicht.',
            'request' => $this->serializeRequest($supporterRequest),
        ], 201);
    }

    #[Route('/mine', name: 'mine', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function mine(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json([
            'request' => ($request = $this->supporterRequestRepository->findOneByUserPending($user->getId()))
                ? $this->serializeRequest($request)
                : null,
            'hasSupporterRole' => in_array('ROLE_SUPPORTER', $user->getRoles(), true),
            'eligibleTeams' => array_values(array_map(fn (Team $team) => [
                'id' => $team->getId(),
                'name' => $team->getName(),
                'hasSupporterScope' => $this->supporterScopeService->canSupportTeam($user, $team),
            ], $this->getEligibleTeams($user))),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRequest(SupporterRequest $request): array
    {
        return [
            'id' => $request->getId(),
            'status' => $request->getStatus(),
            'note' => $request->getNote(),
            'createdAt' => $request->getCreatedAt()->format('d.m.Y H:i'),
            'processedAt' => $request->getProcessedAt()?->format('d.m.Y H:i'),
            'team' => $request->getTeam() ? [
                'id' => $request->getTeam()->getId(),
                'name' => $request->getTeam()->getName(),
            ] : null,
        ];
    }

    /** @return array<int, Team> */
    private function getEligibleTeams(User $user): array
    {
        $teams = [];
        $today = new DateTimeImmutable('today');
        foreach ($user->getUserRelations() as $relation) {
            $player = $relation->getPlayer();
            if (null !== $player) {
                foreach ($player->getPlayerTeamAssignments() as $assignment) {
                    $team = $assignment->getTeam();
                    if ($team && $this->isActive($assignment->getStartDate(), $assignment->getEndDate(), $today)) {
                        $teams[$team->getId()] = $team;
                    }
                }
            }

            $coach = $relation->getCoach();
            if (null !== $coach) {
                foreach ($coach->getCoachTeamAssignments() as $assignment) {
                    $team = $assignment->getTeam();
                    if ($team && $this->isActive($assignment->getStartDate(), $assignment->getEndDate(), $today)) {
                        $teams[$team->getId()] = $team;
                    }
                }
            }
        }

        uasort($teams, static fn (Team $a, Team $b) => $a->getName() <=> $b->getName());

        return $teams;
    }

    private function isActive(?DateTimeInterface $start, ?DateTimeInterface $end, DateTimeImmutable $today): bool
    {
        return (null === $start || DateTimeImmutable::createFromInterface($start)->setTime(0, 0) <= $today)
            && (null === $end || DateTimeImmutable::createFromInterface($end)->setTime(0, 0) >= $today);
    }
}
