<?php

namespace App\Controller\Api\Calendar;

use App\Entity\Location;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/calendar', name: 'api_calendar_')]
class CalendarLocationController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/locations/search', name: 'search_locations', methods: ['GET'])]
    public function searchLocations(Request $request): JsonResponse
    {
        $term = $request->query->get('term', '');

        $qb = $this->entityManager->createQueryBuilder();
        $qb->select('l')
           ->from(Location::class, 'l')
           ->orWhere('l.name LIKE :term')
           ->orWhere('l.city LIKE :term')
           ->orWhere('l.address LIKE :term')
           ->setParameter('term', '%' . $term . '%')
           ->setMaxResults(10);

        $locations = $qb->getQuery()->getArrayResult();

        return new JsonResponse($locations);
    }
}
