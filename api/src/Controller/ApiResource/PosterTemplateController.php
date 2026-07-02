<?php

declare(strict_types=1);

namespace App\Controller\ApiResource;

use App\Entity\PosterTemplate;
use App\Repository\PosterTemplateRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * CRUD-Endpunkte für Poster-Vorlagen.
 *
 * GET    /api/poster-templates                Alle Vorlagen (gefiltert nach ?type=)
 * GET    /api/poster-templates/{id}           Einzelne Vorlage
 * POST   /api/admin/poster-templates          Neue Vorlage anlegen  (ROLE_SUPERADMIN)
 * PUT    /api/admin/poster-templates/{id}     Vorlage aktualisieren (ROLE_SUPERADMIN)
 * DELETE /api/admin/poster-templates/{id}     Vorlage löschen       (ROLE_SUPERADMIN)
 */
class PosterTemplateController extends AbstractController
{
    private const VALID_POSTER_TYPES = [
        'game_announcement',
        'game_result',
        'event_announcement',
        'player_highlight',
        'universal',
    ];

    private const VALID_FORMATS = ['1:1', '9:16', '16:9'];

    public function __construct(
        private readonly PosterTemplateRepository $repository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    // ── GET /api/poster-templates ─────────────────────────────────────────────

    #[Route('/api/poster-templates', name: 'api_poster_templates_index', methods: ['GET'])]
    public function index(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('IS_AUTHENTICATED_FULLY');

        $type = $request->query->get('type');
        if (is_string($type) && '' !== $type) {
            $templates = $this->repository->findByType($type);
        } else {
            $templates = $this->repository->findAllOrderedByName();
        }

        return $this->json(array_map(fn (PosterTemplate $t) => $t->toArray(), $templates));
    }

    // ── GET /api/poster-templates/{id} ───────────────────────────────────────

    #[Route('/api/poster-templates/{id}', name: 'api_poster_templates_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): JsonResponse
    {
        $this->denyAccessUnlessGranted('IS_AUTHENTICATED_FULLY');

        $template = $this->repository->find($id);
        if (null === $template) {
            return $this->json(['error' => 'Vorlage nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        return $this->json($template->toArray());
    }

    // ── POST /api/admin/poster-templates ─────────────────────────────────────

    #[Route('/api/admin/poster-templates', name: 'api_admin_poster_templates_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $body = $this->parseBody($request);
        if (null === $body) {
            return $this->json(['error' => 'Ungültiges JSON'], Response::HTTP_BAD_REQUEST);
        }

        $error = $this->validateBody($body);
        if (null !== $error) {
            return $this->json(['error' => $error], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $template = new PosterTemplate();
        $this->applyBody($template, $body);

        $this->em->persist($template);
        $this->em->flush();

        return $this->json($template->toArray(), Response::HTTP_CREATED);
    }

    // ── PUT /api/admin/poster-templates/{id} ─────────────────────────────────

    #[Route('/api/admin/poster-templates/{id}', name: 'api_admin_poster_templates_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $template = $this->repository->find($id);
        if (null === $template) {
            return $this->json(['error' => 'Vorlage nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        $body = $this->parseBody($request);
        if (null === $body) {
            return $this->json(['error' => 'Ungültiges JSON'], Response::HTTP_BAD_REQUEST);
        }

        $error = $this->validateBody($body);
        if (null !== $error) {
            return $this->json(['error' => $error], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $this->applyBody($template, $body);
        $this->em->flush();

        return $this->json($template->toArray());
    }

    // ── DELETE /api/admin/poster-templates/{id} ───────────────────────────────

    #[Route('/api/admin/poster-templates/{id}', name: 'api_admin_poster_templates_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $template = $this->repository->find($id);
        if (null === $template) {
            return $this->json(['error' => 'Vorlage nicht gefunden'], Response::HTTP_NOT_FOUND);
        }

        $this->em->remove($template);
        $this->em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return array<string, mixed>|null */
    private function parseBody(Request $request): ?array
    {
        $content = $request->getContent();
        if ('' === $content) {
            return null;
        }
        $data = json_decode($content, true);

        return is_array($data) ? $data : null;
    }

    /** @param array<string, mixed> $body */
    private function validateBody(array $body): ?string
    {
        if (empty($body['name']) || !is_string($body['name'])) {
            return 'Feld "name" ist erforderlich';
        }
        if (isset($body['posterType']) && !in_array($body['posterType'], self::VALID_POSTER_TYPES, true)) {
            return 'Ungültiger posterType';
        }
        if (isset($body['supportedFormats'])) {
            if (!is_array($body['supportedFormats'])) {
                return 'supportedFormats muss ein Array sein';
            }
            foreach ($body['supportedFormats'] as $fmt) {
                if (!in_array($fmt, self::VALID_FORMATS, true)) {
                    return sprintf('Ungültiges Format: %s', $fmt);
                }
            }
        }

        return null;
    }

    /** @param array<string, mixed> $body */
    private function applyBody(PosterTemplate $template, array $body): void
    {
        $template->setName(trim((string) $body['name']));
        $template->setDescription(isset($body['description']) ? trim((string) $body['description']) : null);
        $template->setPosterType((string) ($body['posterType'] ?? 'universal'));
        $template->setSupportedFormats(
            is_array($body['supportedFormats'] ?? null)
                ? array_values(array_filter($body['supportedFormats'], fn ($f) => in_array($f, self::VALID_FORMATS, true)))
                : ['1:1'],
        );
        if (is_array($body['background'] ?? null)) {
            $template->setBackground($body['background']);
        }
        if (is_array($body['elements'] ?? null)) {
            $template->setElements($body['elements']);
        }
    }
}
