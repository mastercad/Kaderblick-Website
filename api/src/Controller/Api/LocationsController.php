<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Location;
use App\Entity\SurfaceType;
use App\Security\Voter\LocationVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/api/locations', name: 'api_locations_')]
class LocationsController extends AbstractController
{
    #[Route('', name: 'locations_index', methods: ['GET'])]
    public function index(EntityManagerInterface $entityManager): JsonResponse
    {
        $locations = $entityManager->getRepository(Location::class)->findBy([], ['name' => 'ASC']);

        // Filtere basierend auf VIEW-Berechtigung
        $locations = array_filter($locations, fn ($location) => $this->isGranted(LocationVoter::VIEW, $location));

        return $this->json([
            'locations' => array_map(fn (Location $location) => [
                'id' => $location->getId(),
                'name' => $location->getName(),
                'address' => $location->getAddress(),
                'city' => $location->getCity(),
                'latitude' => $location->getLatitude(),
                'longitude' => $location->getLongitude(),
                'surfaceTypeId' => $location->getSurfaceType()?->getId(),
                'hasFloodlight' => $location->getHasFloodlight() ? true : false,
                'permissions' => [
                    'canCreate' => $this->isGranted(LocationVoter::CREATE, $location),
                    'canEdit' => $this->isGranted(LocationVoter::EDIT, $location),
                    'canView' => $this->isGranted(LocationVoter::VIEW, $location),
                    'canDelete' => $this->isGranted(LocationVoter::DELETE, $location),
                ]
            ], $locations),
            'surfaceTypes' => array_map(
                fn (SurfaceType $surfaceType) => [
                    'id' => $surfaceType->getId(),
                    'name' => $surfaceType->getName(),
                ],
                $entityManager->getRepository(SurfaceType::class)->findBy([], ['name' => 'ASC'])
            ),
        ]);
    }

    #[Route('/osm-coordinates', name: 'api_locations_osm_coordinates', methods: ['GET'])]
    public function osmCoordinates(Request $request, HttpClientInterface $httpClient): JsonResponse
    {
        $query = $request->query->get('query');
        if (!$query) {
            return $this->json([], 400);
        }
        $url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=' . urlencode($query);
        $response = $httpClient->request('GET', $url, [
            'headers' => [
                'User-Agent' => 'Kaderblick/1.0 (kontakt@deinverein.de)'
            ]
        ]);
        $data = $response->toArray();

        return $this->json($data);
    }
}
