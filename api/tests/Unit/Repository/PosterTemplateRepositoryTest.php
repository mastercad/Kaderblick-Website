<?php

declare(strict_types=1);

namespace App\Tests\Unit\Repository;

use App\Entity\PosterTemplate;
use App\Repository\PosterTemplateRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Unit-Tests für PosterTemplateRepository::findTemplatesUsingImageFilename().
 *
 * findAll() wird gemockt — kein echter Datenbankzugriff.
 */
#[AllowMockObjectsWithoutExpectations]
class PosterTemplateRepositoryTest extends TestCase
{
    private EntityManagerInterface&MockObject $em;
    private PosterTemplateRepository $repository;

    /** @var PosterTemplate[] */
    public array $stubbedTemplates = [];

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);

        $classMetadata = $this->createMock(ClassMetadata::class);
        $classMetadata->name = PosterTemplate::class;
        $this->em->method('getClassMetadata')->willReturn($classMetadata);

        // findAll() delegiert intern an UnitOfWork/EntityManager → wir stubben getRepository
        // Einfacher Weg: Repository überschreiben via Subklasse
        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->em);

        $self = $this;
        $this->repository = new class ($registry, $self) extends PosterTemplateRepository {
            private PosterTemplateRepositoryTest $test;

            public function __construct(ManagerRegistry $registry, PosterTemplateRepositoryTest $test)
            {
                parent::__construct($registry);
                $this->test = $test;
            }

            /** @return PosterTemplate[] */
            public function findAll(): array
            {
                return $this->test->stubbedTemplates;
            }
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Hilfsmethode
    // ─────────────────────────────────────────────────────────────────────────

    private function makeTemplate(string $name, ?string $imageUrl): PosterTemplate
    {
        $t = new PosterTemplate();
        $t->setName($name);
        $bg = ['type' => 'solid', 'color' => '#000'];
        if (null !== $imageUrl) {
            $bg['imageUrl'] = $imageUrl;
        }
        $t->setBackground($bg);

        return $t;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // findTemplatesUsingImageFilename
    // ─────────────────────────────────────────────────────────────────────────

    public function testGibtMatchendeTemplatesZurueck(): void
    {
        $this->stubbedTemplates = [
            $this->makeTemplate('Vorlage A', '/uploads/poster/poster_abc.jpg'),
            $this->makeTemplate('Vorlage B', '/uploads/poster/poster_xyz.png'),
            $this->makeTemplate('Vorlage C', null),
        ];

        $result = $this->repository->findTemplatesUsingImageFilename('poster_abc.jpg');

        $this->assertCount(1, $result);
        $this->assertSame('Vorlage A', $result[0]->getName());
    }

    public function testGibtLeereArrayZurueckWennKeinMatch(): void
    {
        $this->stubbedTemplates = [
            $this->makeTemplate('Vorlage A', '/uploads/poster/poster_abc.jpg'),
            $this->makeTemplate('Vorlage B', '/uploads/poster/poster_xyz.png'),
        ];

        $result = $this->repository->findTemplatesUsingImageFilename('nicht_vorhanden.jpg');

        $this->assertSame([], $result);
    }

    public function testGibtMehrereMatchendeTemplatesZurueck(): void
    {
        $filename = 'shared.jpg';
        $this->stubbedTemplates = [
            $this->makeTemplate('Alpha', "/uploads/poster/$filename"),
            $this->makeTemplate('Beta', "/uploads/poster/$filename"),
            $this->makeTemplate('Gamma', '/uploads/poster/other.jpg'),
        ];

        $result = $this->repository->findTemplatesUsingImageFilename($filename);

        $this->assertCount(2, $result);
        $names = array_map(static fn (PosterTemplate $t) => $t->getName(), $result);
        $this->assertContains('Alpha', $names);
        $this->assertContains('Beta', $names);
    }

    public function testVergleichtNurBasenameNichtVollenPfad(): void
    {
        $this->stubbedTemplates = [
            $this->makeTemplate('Mit Pfad', 'https://cdn.example.com/uploads/poster/img.jpg'),
            $this->makeTemplate('Ohne Pfad', 'img.jpg'),
        ];

        $result = $this->repository->findTemplatesUsingImageFilename('img.jpg');

        $this->assertCount(2, $result);
    }

    public function testIgnoriertTemplatesOhneImageUrl(): void
    {
        $this->stubbedTemplates = [
            $this->makeTemplate('Kein Bild 1', null),
            $this->makeTemplate('Kein Bild 2', null),
        ];

        $result = $this->repository->findTemplatesUsingImageFilename('irgendwas.jpg');

        $this->assertSame([], $result);
    }

    public function testGibtLeereArrayZurueckWennKeinTemplateExistiert(): void
    {
        $this->stubbedTemplates = [];

        $result = $this->repository->findTemplatesUsingImageFilename('whatever.png');

        $this->assertSame([], $result);
    }
}
