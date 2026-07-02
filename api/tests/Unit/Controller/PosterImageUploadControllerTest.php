<?php

declare(strict_types=1);

namespace App\Tests\Unit\Controller;

use App\Controller\ApiResource\PosterImageUploadController;
use App\Entity\PosterTemplate;
use App\Repository\PosterTemplateRepository;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Unit-Tests für den DELETE-Endpunkt von PosterImageUploadController.
 *
 * Kein HTTP-Stack, kein Datenbank-Zugriff.
 * AuthorizationChecker wird gemockt und erlaubt immer ROLE_SUPERADMIN.
 */
#[AllowMockObjectsWithoutExpectations]
class PosterImageUploadControllerTest extends TestCase
{
    private PosterTemplateRepository & MockObject $repository;
    private PosterImageUploadController $controller;
    private string $uploadDir;
    private string $projectDir;

    protected function setUp(): void
    {
        $this->repository = $this->createMock(PosterTemplateRepository::class);

        $this->projectDir = sys_get_temp_dir() . '/poster_ctrl_test_' . uniqid('', true);
        $this->uploadDir = $this->projectDir . '/public/uploads/poster';
        mkdir($this->uploadDir, 0777, true);

        $this->controller = new PosterImageUploadController();

        // Container mit Stub-Services, die AbstractController benötigt
        $container = new ContainerBuilder();

        // kernel.project_dir wird über getParameter() abgefragt;
        // AbstractController::getParameter() holt sich 'parameter_bag' aus dem Container
        $projectDir = $this->projectDir;
        $container->set('parameter_bag', new class ($projectDir) {
            public function __construct(private readonly string $projectDir)
            {
            }

            public function get(string $name): mixed
            {
                return match ($name) {
                    'kernel.project_dir' => $this->projectDir,
                    default => throw new RuntimeException("Unbekannter Parameter: $name"),
                };
            }
        });

        // AbstractController::json() braucht einen Serializer
        $container->set('serializer', new class {
            /** @param array<string, mixed> $context */
            public function serialize(mixed $data, string $format, array $context = []): string
            {
                return json_encode($data, JSON_THROW_ON_ERROR);
            }
        });

        // denyAccessUnlessGranted() → AuthorizationChecker immer true
        $authChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authChecker->method('isGranted')->willReturn(true);
        $container->set('security.authorization_checker', $authChecker);

        $this->controller->setContainer($container);
    }

    protected function tearDown(): void
    {
        // Temporäres Upload-Verzeichnis aufräumen
        foreach (glob($this->uploadDir . '/*') ?: [] as $f) {
            if (is_file($f)) {
                unlink($f);
            }
        }
        if (is_dir($this->uploadDir)) {
            rmdir($this->uploadDir);
        }
        $publicDir = $this->projectDir . '/public/uploads';
        if (is_dir($publicDir)) {
            @rmdir($publicDir);
        }
        $uploadsBase = $this->projectDir . '/public';
        if (is_dir($uploadsBase)) {
            @rmdir($uploadsBase);
        }
        if (is_dir($this->projectDir)) {
            @rmdir($this->projectDir);
        }
    }

    // ─── Hilfsmethode ─────────────────────────────────────────────────────────

    /** Legt eine leere Dummy-Datei im Upload-Verzeichnis an. */
    private function createFile(string $filename): void
    {
        file_put_contents($this->uploadDir . '/' . $filename, '');
    }

    // ─── Path-Traversal-Schutz ────────────────────────────────────────────────

    public function testDeleteGibtBadRequestZurueckFuerDotDatei(): void
    {
        $response = $this->controller->delete('.htaccess', $this->repository);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testDeleteGibtBadRequestZurueckFuerSlashImNamen(): void
    {
        $response = $this->controller->delete('../etc/passwd', $this->repository);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testDeleteGibtBadRequestZurueckFuerBackslashImNamen(): void
    {
        $response = $this->controller->delete('foo\\bar.jpg', $this->repository);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testDeleteGibtBadRequestZurueckFuerLeerenNamen(): void
    {
        $response = $this->controller->delete('', $this->repository);

        $this->assertSame(400, $response->getStatusCode());
    }

    // ─── 404 – Datei nicht vorhanden ─────────────────────────────────────────

    public function testDeleteGibt404ZurueckWennDateiNichtExistiert(): void
    {
        $response = $this->controller->delete('nicht_da.jpg', $this->repository);

        $this->assertSame(404, $response->getStatusCode());
    }

    // ─── 409 – Bild in Verwendung ─────────────────────────────────────────────

    public function testDeleteGibt409ZurueckWennBildInVorlagenVerwendetWird(): void
    {
        $this->createFile('used.jpg');

        $templateA = new PosterTemplate();
        $templateA->setName('Vorlage Alpha');
        $templateB = new PosterTemplate();
        $templateB->setName('Vorlage Beta');

        $this->repository
            ->method('findTemplatesUsingImageFilename')
            ->with('used.jpg')
            ->willReturn([$templateA, $templateB]);

        $response = $this->controller->delete('used.jpg', $this->repository);

        $this->assertSame(409, $response->getStatusCode());

        /** @var array{error: string, templates: string[]} $data */
        $data = json_decode((string) $response->getContent(), true);
        $this->assertContains('Vorlage Alpha', $data['templates']);
        $this->assertContains('Vorlage Beta', $data['templates']);
    }

    // ─── 204 – Erfolgreiches Löschen ─────────────────────────────────────────

    public function testDeleteGibt204ZurueckUndEntferntDatei(): void
    {
        $this->createFile('delete_me.jpg');
        $this->assertTrue(is_file($this->uploadDir . '/delete_me.jpg'));

        $this->repository
            ->method('findTemplatesUsingImageFilename')
            ->willReturn([]);

        $response = $this->controller->delete('delete_me.jpg', $this->repository);

        $this->assertSame(204, $response->getStatusCode());
        $this->assertFalse(is_file($this->uploadDir . '/delete_me.jpg'), 'Datei wurde nicht gelöscht');
    }

    public function testDeleteGibt204AuchWennContentNullIst(): void
    {
        $this->createFile('clean.png');
        $this->repository->method('findTemplatesUsingImageFilename')->willReturn([]);

        $response = $this->controller->delete('clean.png', $this->repository);

        $this->assertSame(204, $response->getStatusCode());
        // JsonResponse(null, 204): Symfony wandelt null zu new ArrayObject() → '{}'
        $this->assertSame('{}', $response->getContent());
    }
}
