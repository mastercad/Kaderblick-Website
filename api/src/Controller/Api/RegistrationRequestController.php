<?php

namespace App\Controller\Api;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\RegistrationRequest;
use App\Entity\RelationType;
use App\Entity\User;
use App\Repository\RegistrationRequestRepository;
use App\Service\RegistrationNotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Throwable;

#[Route('/api/registration-request', name: 'api_registration_request_')]
class RegistrationRequestController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private RegistrationNotificationService $notificationService,
        private RegistrationRequestRepository $requestRepository
    ) {
    }

    /**
     * Returns only relation types for the registration context dialog.
     * Players/coaches are fetched on demand via /context/search.
     */
    #[Route('/context', name: 'context', methods: ['GET'])]
    public function context(): JsonResponse
    {
        $relationTypes = $this->em->getRepository(RelationType::class)->findBy([], ['name' => 'ASC']);

        return $this->json([
            'relationTypes' => array_map(fn (RelationType $rt) => [
                'id' => $rt->getId(),
                'identifier' => $rt->getIdentifier(),
                'name' => $rt->getName(),
                'category' => $rt->getCategory(),
            ], $relationTypes),
        ]);
    }

    /**
     * Search players or coaches by name (min. 2 characters).
     */
    #[Route('/context/search', name: 'context_search', methods: ['GET'])]
    public function contextSearch(Request $request): JsonResponse
    {
        $type = $request->query->get('type');
        $q = trim((string) $request->query->get('q', ''));

        if (!in_array($type, ['player', 'coach'], true)) {
            return $this->json(['error' => 'type muss "player" oder "coach" sein.'], 400);
        }

        if (mb_strlen($q) < 2) {
            return $this->json(['results' => []]);
        }

        $search = '%' . mb_strtolower($q) . '%';

        if ('player' === $type) {
            $qb = $this->em->getRepository(Player::class)->createQueryBuilder('p')
                ->where('LOWER(p.firstName) LIKE :q OR LOWER(p.lastName) LIKE :q OR LOWER(CONCAT(p.firstName, \' \', p.lastName)) LIKE :q')
                ->setParameter('q', $search)
                ->orderBy('p.lastName', 'ASC')
                ->addOrderBy('p.firstName', 'ASC')
                ->setMaxResults(30);

            $results = array_map(fn (Player $p) => [
                'id' => $p->getId(),
                'fullName' => $p->getFullName(),
                'teams' => array_values(array_unique(array_map(
                    fn ($pta) => $pta->getTeam()->getName(),
                    $p->getPlayerTeamAssignments()->toArray()
                ))),
            ], $qb->getQuery()->getResult());
        } else {
            $qb = $this->em->getRepository(Coach::class)->createQueryBuilder('c')
                ->where('LOWER(c.firstName) LIKE :q OR LOWER(c.lastName) LIKE :q OR LOWER(CONCAT(c.firstName, \' \', c.lastName)) LIKE :q')
                ->setParameter('q', $search)
                ->orderBy('c.lastName', 'ASC')
                ->addOrderBy('c.firstName', 'ASC')
                ->setMaxResults(30);

            $results = array_map(fn (Coach $c) => [
                'id' => $c->getId(),
                'fullName' => $c->getFullName(),
                'teams' => array_values(array_unique(array_map(
                    fn ($cta) => $cta->getTeam()->getName(),
                    $c->getCoachTeamAssignments()->toArray()
                ))),
            ], $qb->getQuery()->getResult());
        }

        return $this->json(['results' => $results]);
    }

    /**
     * Submit a registration context / relation request.
     * Requires authentication (user must be logged in).
     */
    #[Route('', name: 'submit', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function submit(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        // Check if user already has a pending request
        $existing = $this->requestRepository->findOneByUserPending($user->getId());
        if ($existing) {
            return $this->json([
                'error' => 'Du hast bereits einen offenen Zuordnungsantrag. Bitte warte auf die Bearbeitung durch einen Administrator.'
            ], 409);
        }

        $data = json_decode($request->getContent(), true);

        $entityType = $data['entityType'] ?? null; // 'player' or 'coach'
        $entityId = (int) ($data['entityId'] ?? 0);
        $relationTypeId = (int) ($data['relationTypeId'] ?? 0);
        $note = isset($data['note']) ? trim((string) $data['note']) : null;

        if (!$entityType || !$entityId || !$relationTypeId) {
            return $this->json(['error' => 'entityType, entityId und relationTypeId sind erforderlich.'], 400);
        }

        $relationType = $this->em->getRepository(RelationType::class)->find($relationTypeId);
        if (!$relationType) {
            return $this->json(['error' => 'Unbekannter Beziehungstyp.'], 400);
        }

        $registrationRequest = new RegistrationRequest();
        $registrationRequest->setUser($user)
            ->setRelationType($relationType)
            ->setNote($note ?: null);

        if ('player' === $entityType) {
            $player = $this->em->getRepository(Player::class)->find($entityId);
            if (!$player) {
                return $this->json(['error' => 'Spieler nicht gefunden.'], 404);
            }
            $registrationRequest->setPlayer($player);
        } elseif ('coach' === $entityType) {
            $coach = $this->em->getRepository(Coach::class)->find($entityId);
            if (!$coach) {
                return $this->json(['error' => 'Trainer nicht gefunden.'], 404);
            }
            $registrationRequest->setCoach($coach);
        } else {
            return $this->json(['error' => 'entityType muss "player" oder "coach" sein.'], 400);
        }

        $this->em->persist($registrationRequest);
        $this->em->flush();

        // Notify admins about the new relation request
        try {
            $this->notificationService->notifyAdminsAboutRegistrationRequest($registrationRequest);
        } catch (Throwable) {
            // Non-critical – don't fail the request
        }

        return $this->json([
            'message' => 'Dein Zuordnungsantrag wurde erfolgreich eingereicht. Ein Administrator wird diesen in Kürze prüfen.'
        ], 201);
    }

    /**
     * Returns the current user's own pending registration request (if any).
     */
    #[Route('/mine', name: 'mine', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function mine(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $pending = $this->requestRepository->findOneByUserPending($user->getId());

        if (!$pending) {
            return $this->json(['request' => null]);
        }

        return $this->json([
            'request' => $this->serializeRequest($pending)
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRequest(RegistrationRequest $r): array
    {
        return [
            'id' => $r->getId(),
            'status' => $r->getStatus(),
            'note' => $r->getNote(),
            'createdAt' => $r->getCreatedAt()->format('d.m.Y H:i'),
            'relationType' => [
                'id' => $r->getRelationType()->getId(),
                'name' => $r->getRelationType()->getName(),
                'identifier' => $r->getRelationType()->getIdentifier(),
            ],
            'player' => $r->getPlayer() ? ['id' => $r->getPlayer()->getId(), 'fullName' => $r->getPlayer()->getFullName()] : null,
            'coach' => $r->getCoach() ? ['id' => $r->getCoach()->getId(),  'fullName' => $r->getCoach()->getFullName()] : null,
        ];
    }
}
