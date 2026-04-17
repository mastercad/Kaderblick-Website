<?php

namespace App\Controller\Api;

use App\Entity\CupRound;
use App\Repository\CupRoundRepository;
use App\Repository\GameRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/cup-rounds', name: 'api_cup_rounds_')]
class CupRoundsController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private CupRoundRepository $cupRoundRepository,
        private GameRepository $gameRepository,
    ) {
    }

    #[Route('', methods: ['GET'], name: 'index')]
    public function index(): JsonResponse
    {
        $rounds = $this->cupRoundRepository->findBy([], ['name' => 'ASC']);

        return $this->json([
            'rounds' => array_map(fn (CupRound $r) => [
                'id' => $r->getId(),
                'name' => $r->getName(),
            ], $rounds),
        ]);
    }

    #[Route('', methods: ['POST'], name: 'create')]
    public function create(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $data = json_decode($request->getContent(), true);
        $name = trim((string) ($data['name'] ?? ''));

        if ('' === $name) {
            return $this->json(['error' => 'Name darf nicht leer sein.'], 422);
        }

        $round = new CupRound();
        $round->setName($name);

        $this->entityManager->persist($round);
        $this->entityManager->flush();

        return $this->json(['round' => ['id' => $round->getId(), 'name' => $round->getName()]], 201);
    }

    #[Route('/{id}', methods: ['PUT'], name: 'update')]
    public function update(CupRound $round, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $data = json_decode($request->getContent(), true);
        $name = trim((string) ($data['name'] ?? ''));

        if ('' === $name) {
            return $this->json(['error' => 'Name darf nicht leer sein.'], 422);
        }

        $oldName = $round->getName();

        if ($name === $oldName) {
            return $this->json(['round' => ['id' => $round->getId(), 'name' => $round->getName()]]);
        }

        $round->setName($name);
        $this->entityManager->flush();

        $updated = $this->gameRepository->bulkUpdateRound($oldName, $name);

        return $this->json([
            'round' => ['id' => $round->getId(), 'name' => $round->getName()],
            'gamesUpdated' => $updated,
        ]);
    }

    #[Route('/{id}', methods: ['DELETE'], name: 'delete')]
    public function delete(CupRound $round): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $count = $this->gameRepository->countByRound($round->getName());
        if ($count > 0) {
            return $this->json([
                'error' => sprintf(
                    'Der Rundenname "%s" wird noch in %d Spiel%s verwendet und kann nicht gelöscht werden.',
                    $round->getName(),
                    $count,
                    1 === $count ? '' : 'en'
                ),
                'usageCount' => $count,
            ], 409);
        }

        $this->entityManager->remove($round);
        $this->entityManager->flush();

        return $this->json(['message' => 'Rundenname gelöscht.']);
    }
}
