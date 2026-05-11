<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\PosterTemplate;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @template-extends ServiceEntityRepository<PosterTemplate>
 */
class PosterTemplateRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PosterTemplate::class);
    }

    /**
     * @return PosterTemplate[]
     */
    public function findByType(string $posterType): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.posterType = :type OR p.posterType = :universal')
            ->setParameter('type', $posterType)
            ->setParameter('universal', 'universal')
            ->orderBy('p.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return PosterTemplate[]
     */
    public function findAllOrderedByName(): array
    {
        return $this->createQueryBuilder('p')
            ->orderBy('p.posterType', 'ASC')
            ->addOrderBy('p.name', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Gibt alle Templates zurück, die das Bild mit dem angegebenen Dateinamen verwenden.
     *
     * @return PosterTemplate[]
     */
    public function findTemplatesUsingImageFilename(string $filename): array
    {
        /** @var PosterTemplate[] $all */
        $all = $this->findAll();

        return array_values(array_filter($all, static function (PosterTemplate $t) use ($filename): bool {
            $imageUrl = $t->getBackground()['imageUrl'] ?? null;

            return null !== $imageUrl && basename((string) $imageUrl) === $filename;
        }));
    }
}
