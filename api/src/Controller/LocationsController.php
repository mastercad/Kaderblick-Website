<?php

namespace App\Controller;

use App\Entity\Location;
use App\Entity\SurfaceType;
use App\Repository\SurfaceTypeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class LocationsController extends AbstractController
{
    #[Route('/locations/edit/{id}', name: 'locations_edit', methods: ['GET'])]
    public function edit(Location $location, SurfaceTypeRepository $surfaceTypeRepository): Response
    {
        $surfaceTypes = $surfaceTypeRepository->findAll();

        return $this->render('locations/edit_modal.html.twig', [
            'location' => $location,
            'surfaceTypes' => $surfaceTypes,
        ]);
    }

    #[Route('/api/locations/{id}', name: 'locations_update', methods: ['PUT'])]
    public function update(Location $location, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $jsonData = json_decode($request->getContent(), true);
        $location->setName($jsonData['name']);
        $location->setAddress($jsonData['address']);
        $location->setCity($jsonData['city']);
        $capacity = $jsonData['capacity'];
        $location->setCapacity(null === $capacity || '' === $capacity ? null : (int) $capacity);
        $location->setFacilities($jsonData['facilities']);
        $location->setLatitude($jsonData['latitude']);
        $location->setLongitude($jsonData['longitude']);
        $surfaceTypeId = $jsonData['surfaceTypeId'];
        if ($surfaceTypeId) {
            $surfaceType = $em->getRepository(SurfaceType::class)->find($surfaceTypeId);
            $location->setSurfaceType($surfaceType);
        } else {
            $location->setSurfaceType(null);
        }
        $location->setHasFloodlight($jsonData['hasFloodlight'] ?? false);

        $em->persist($location);
        $em->flush();

        return $this->json([
            'success' => true,
            'location' => [
                'id' => $location->getId(),
                'name' => $location->getName(),
                'latitude' => $location->getLatitude(),
                'longitude' => $location->getLongitude(),
                'adddress' => $location->getAddress(),
                'capacity' => $location->getCapacity(),
                'hasFloodlight' => $location->getHasFloodlight(),
                'facilities' => $location->getFacilities(),
                'city' => $location->getCity(),
                'surfaceTypeId' => $location->getSurfaceType()?->getId(),
            ]
        ]);
    }

    #[Route('/api/locations', name: 'locations_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $jsonData = json_decode($request->getContent(), true);

        $location = new Location();
        $location->setName($jsonData['name']);
        $location->setAddress($jsonData['address']);
        $location->setCity($jsonData['city']);
        $capacity = $jsonData['capacity'];
        $location->setCapacity(null === $capacity || '' === $capacity ? null : (int) $capacity);
        $location->setFacilities($jsonData['facilities']);
        $location->setLatitude(!empty($jsonData['latitude']) ? (float) $jsonData['latitude'] : null);
        $location->setLongitude(!empty($jsonData['longitude']) ? (float) $jsonData['longitude'] : null);
        $surfaceTypeId = $jsonData['surfaceTypeId'];
        if ($surfaceTypeId) {
            $surfaceType = $em->getRepository(SurfaceType::class)->find($surfaceTypeId);
            $location->setSurfaceType($surfaceType);
        } else {
            $location->setSurfaceType(null);
        }
        $location->setHasFloodlight($jsonData['hasFloodlight'] ?? false);

        $em->persist($location);
        $em->flush();

        return $this->json([
            'success' => true,
            'location' => [
                'id' => $location->getId(),
                'name' => $location->getName(),
                'latitude' => $location->getLatitude(),
                'longitude' => $location->getLongitude(),
                'adddress' => $location->getAddress(),
                'capacity' => $location->getCapacity(),
                'hasFloodlight' => $location->getHasFloodlight(),
                'facilities' => $location->getFacilities(),
                'city' => $location->getCity(),
                'surfaceTypeId' => $location->getSurfaceType()?->getId()
            ]
        ]);
    }

    #[Route('/locations/delete/{id}', name: 'locations_delete', methods: ['DELETE'])]
    public function delete(Location $location, EntityManagerInterface $em): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_SUPERADMIN');

        $em->remove($location);
        $em->flush();

        return $this->json(['success' => true]);
    }
}
