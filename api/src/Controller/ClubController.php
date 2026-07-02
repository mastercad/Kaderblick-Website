<?php

namespace App\Controller;

use App\Entity\Club;
use App\Entity\Location;
use App\Repository\ClubRepository;
use App\Security\Voter\ClubVoter;
use App\Service\FussballDeCrawlerService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('IS_AUTHENTICATED')]
class ClubController extends AbstractController
{
    #[Route('/clubs', name: 'club_list', methods: ['GET'])]
    public function list(ClubRepository $clubRepository, Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 25)));
        $search = trim((string) $request->query->get('search', ''));

        $qb = $clubRepository->createQueryBuilder('c');

        // Search filter
        if ('' !== $search) {
            $qb->andWhere('LOWER(c.name) LIKE :search OR LOWER(c.stadiumName) LIKE :search OR LOWER(c.shortName) LIKE :search')
               ->setParameter('search', '%' . strtolower($search) . '%');
        }

        // Count total matching results
        $countQb = clone $qb;
        $countQb->select('COUNT(c.id)');
        $total = (int) $countQb->getQuery()->getSingleScalarResult();

        // Fetch paginated results
        $offset = ($page - 1) * $limit;
        $qb->orderBy('c.name', 'ASC')
           ->setFirstResult($offset)
           ->setMaxResults($limit);

        $clubs = $qb->getQuery()->getResult();

        // Permissions: VIEW always true, CREATE/EDIT/DELETE require ROLE_SUPERADMIN
        $isAdmin = $this->isGranted('ROLE_SUPERADMIN');

        return $this->json([
            'clubs' => array_map(
                fn (Club $club) => [
                    'id' => $club->getId(),
                    'name' => $club->getName(),
                    'shortName' => $club->getShortName(),
                    'abbreviation' => $club->getAbbreviation(),
                    'stadiumName' => $club->getStadiumName(),
                    'website' => $club->getWebsite(),
                    'logoUrl' => $club->getLogoUrl(),
                    'email' => $club->getEmail(),
                    'phone' => $club->getPhone(),
                    'clubColors' => $club->getClubColors(),
                    'contactPerson' => $club->getContactPerson(),
                    'foundingYear' => $club->getFoundingYear(),
                    'active' => $club->isActive(),
                    'location' => [
                        'id' => $club->getLocation()?->getId(),
                        'name' => $club->getLocation()?->getName(),
                        'city' => $club->getLocation()?->getCity(),
                        'address' => $club->getLocation()?->getAddress(),
                        'latitude' => $club->getLocation()?->getLatitude(),
                        'longitude' => $club->getLocation()?->getLongitude(),
                        'surfaceType' => $club->getLocation()?->getSurfaceType() ? [
                            'id' => $club->getLocation()->getSurfaceType()->getId(),
                            'name' => $club->getLocation()->getSurfaceType()->getName(),
                        ] : null,
                    ],
                    'permissions' => [
                        'canCreate' => $isAdmin,
                        'canEdit' => $isAdmin,
                        'canView' => true,
                        'canDelete' => $isAdmin,
                    ]
                ],
                $clubs
            ),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
        ]);
    }

    #[Route('/clubs/{id}/details', name: 'club_detail_modal', methods: ['GET'])]
    public function detailModal(Club $club): Response
    {
        if (!$this->isGranted(ClubVoter::VIEW, $club)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        return $this->json(
            [
                'club' => [
                    'id' => $club->getId(),
                    'name' => $club->getName(),
                    'shortName' => $club->getShortName(),
                    'abbreviation' => $club->getAbbreviation(),
                    'stadiumName' => $club->getStadiumName(),
                    'website' => $club->getWebsite(),
                    'logoUrl' => $club->getLogoUrl(),
                    'email' => $club->getEmail(),
                    'phone' => $club->getPhone(),
                    'clubColors' => $club->getClubColors(),
                    'contactPerson' => $club->getContactPerson(),
                    'foundingYear' => $club->getFoundingYear(),
                    'active' => $club->isActive(),
                    'location' => [
                        'id' => $club->getLocation()?->getId(),
                        'name' => $club->getLocation()?->getName(),
                        'city' => $club->getLocation()?->getCity(),
                        'address' => $club->getLocation()?->getAddress(),
                        'latitude' => $club->getLocation()?->getLatitude(),
                        'longitude' => $club->getLocation()?->getLongitude(),
                        'surfaceType' => $club->getLocation()?->getSurfaceType() ? [
                            'id' => $club->getLocation()->getSurfaceType()->getId(),
                            'name' => $club->getLocation()->getSurfaceType()->getName(),
                        ] : null,
                    ]
                ],
                'permissions' => [
                    'canCreate' => $this->isGranted(ClubVoter::CREATE, $club),
                    'canEdit' => $this->isGranted(ClubVoter::EDIT, $club),
                    'canView' => $this->isGranted(ClubVoter::VIEW, $club),
                    'canDelete' => $this->isGranted(ClubVoter::DELETE, $club),
                ]
            ]
        );
    }

    #[Route('/clubs/{id}/edit', name: 'club_edit_modal', methods: ['GET'])]
    public function editModal(Club $club): Response
    {
        return $this->render('club/edit_modal.html.twig', [
            'club' => $club,
        ]);
    }

    #[Route('/clubs/{id}', name: 'club_update', methods: ['PUT'])]
    public function update(Request $request, Club $club, EntityManagerInterface $em): JsonResponse
    {
        $clubData = json_decode($request->getContent(), true);

        if (
            !$this->isGranted('ROLE_SUPERADMIN')
            || !$this->isGranted(ClubVoter::EDIT, $club)
        ) {
            return new JsonResponse(['error' => 'Unauthorized'], 403);
        }

        // Validierung & Filterung
        $logoUrl = trim($clubData['logoUrl'] ?? $club->getLogoUrl());
        $fussballDeId = trim($clubData['fussballDeId'] ?? $club->getFussballDeId());
        $fussballDeUrl = trim($clubData['fussballDeUrl'] ?? $club->getFussballDeUrl());
        $name = trim($clubData['name'] ?? $club->getName());
        $shortName = trim($clubData['shortName'] ?? $club->getShortName());
        $stadiumName = trim($clubData['stadiumName'] ?? $club->getStadiumName());
        $website = trim($clubData['website'] ?? $club->getWebsite());
        $email = trim($clubData['email'] ?? $club->getEmail());
        $phone = trim($clubData['phone'] ?? $club->getPhone());
        $clubColors = trim($clubData['clubColors'] ?? $club->getClubColors());
        $contactPerson = trim($clubData['contactPerson'] ?? $club->getContactPerson());
        $foundingYearRaw = $clubData['foundingYear'] ?? $club->getFoundingYear();
        $foundingYear = ('' !== $foundingYearRaw && is_numeric($foundingYearRaw)) ? (int) $foundingYearRaw : null;
        $active = isset($clubData['active']) ? (bool) $clubData['active'] : false;

        // Setzen ins Entity
        $club->setLogoUrl('' !== $logoUrl ? $logoUrl : null);
        $club->setFussballDeId('' !== $fussballDeId ? $fussballDeId : null);
        $club->setFussballDeUrl('' !== $fussballDeUrl ? $fussballDeUrl : null);
        $club->setName($name);
        $club->setShortName('' !== $shortName ? $shortName : null);
        $club->setStadiumName('' !== $stadiumName ? $stadiumName : null);
        $club->setWebsite('' !== $website ? $website : null);
        $club->setEmail('' !== $email ? $email : null);
        $club->setPhone('' !== $phone ? $phone : null);
        $club->setActive($active);
        $club->setClubColors('' !== $clubColors ? $clubColors : null);
        $club->setContactPerson('' !== $contactPerson ? $contactPerson : null);
        $club->setFoundingYear($foundingYear);

        if ($clubData['location'] && is_array($clubData['location']) && isset($clubData['location']['id'])) {
            $location = $em->getRepository(Location::class)->find($clubData['location']['id']);
            if ($location) {
                $club->setLocation($location);
            }
        }

        $em->persist($club);
        $em->flush();

        return new JsonResponse(
            [
                'success' => true,
                'club' => [
                    'id' => $club->getId(),
                    'name' => $club->getName(),
                    'shortName' => $club->getShortName(),
                    'abbreviation' => $club->getAbbreviation(),
                    'stadiumName' => $club->getStadiumName(),
                    'website' => $club->getWebsite(),
                    'logoUrl' => $club->getLogoUrl(),
                    'email' => $club->getEmail(),
                    'phone' => $club->getPhone(),
                    'clubColors' => $club->getClubColors(),
                    'contactPerson' => $club->getContactPerson(),
                    'foundingYear' => $club->getFoundingYear(),
                    'active' => $club->isActive(),
                    'location' => [
                        'id' => $club->getLocation()?->getId(),
                        'name' => $club->getLocation()?->getName(),
                        'city' => $club->getLocation()?->getCity(),
                        'address' => $club->getLocation()?->getAddress(),
                        'latitude' => $club->getLocation()?->getLatitude(),
                        'longitude' => $club->getLocation()?->getLongitude(),
                        'surfaceType' => $club->getLocation()?->getSurfaceType() ? [
                            'id' => $club->getLocation()->getSurfaceType()->getId(),
                            'name' => $club->getLocation()->getSurfaceType()->getName(),
                        ] : null,
                    ]
                ],
                'permissions' => [
                    'canCreate' => $this->isGranted(ClubVoter::CREATE, $club),
                    'canEdit' => $this->isGranted(ClubVoter::EDIT, $club),
                    'canView' => $this->isGranted(ClubVoter::VIEW, $club),
                    'canDelete' => $this->isGranted(ClubVoter::DELETE, $club),
                ]
            ]
        );
    }

    #[Route('/clubs', name: 'club_create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $club = new Club();

        if (
            !$this->isGranted('ROLE_SUPERADMIN')
            || !$this->isGranted(ClubVoter::CREATE, $club)
        ) {
            return new JsonResponse(['error' => 'Unauthorized'], 403);
        }

        $clubData = json_decode($request->getContent(), true);

        // Validierung & Filterung
        $logoUrl = trim($clubData['logoUrl'] ?? $club->getLogoUrl());
        $fussballDeId = trim($clubData['fussballDeId'] ?? $club->getFussballDeId());
        $fussballDeUrl = trim($clubData['fussballDeUrl'] ?? $club->getFussballDeUrl());
        $name = trim($clubData['name'] ?? $club->getName());
        $shortName = trim($clubData['shortName'] ?? $club->getShortName());
        $stadiumName = trim($clubData['stadiumName'] ?? $club->getStadiumName());
        $website = trim($clubData['website'] ?? $club->getWebsite());
        $email = trim($clubData['email'] ?? $club->getEmail());
        $phone = trim($clubData['phone'] ?? $club->getPhone());
        $clubColors = trim($clubData['clubColors'] ?? $club->getClubColors());
        $contactPerson = trim($clubData['contactPerson'] ?? $club->getContactPerson());
        $foundingYearRaw = $clubData['foundingYear'] ?? $club->getFoundingYear();
        $foundingYear = ('' !== $foundingYearRaw && is_numeric($foundingYearRaw)) ? (int) $foundingYearRaw : null;
        $active = isset($clubData['active']) ? (bool) $clubData['active'] : false;

        // Setzen ins Entity
        $club->setLogoUrl('' !== $logoUrl ? $logoUrl : null);
        $club->setFussballDeId('' !== $fussballDeId ? $fussballDeId : null);
        $club->setFussballDeUrl('' !== $fussballDeUrl ? $fussballDeUrl : null);
        $club->setName($name);
        $club->setShortName('' !== $shortName ? $shortName : null);
        $club->setStadiumName('' !== $stadiumName ? $stadiumName : null);
        $club->setWebsite('' !== $website ? $website : null);
        $club->setEmail('' !== $email ? $email : null);
        $club->setPhone('' !== $phone ? $phone : null);
        $club->setActive($active);
        $club->setClubColors('' !== $clubColors ? $clubColors : null);
        $club->setContactPerson('' !== $contactPerson ? $contactPerson : null);
        $club->setFoundingYear($foundingYear);

        if ($clubData['location'] && is_array($clubData['location']) && isset($clubData['location']['id'])) {
            $location = $em->getRepository(Location::class)->find($clubData['location']['id']);
            if ($location) {
                $club->setLocation($location);
            }
        }

        $em->persist($club);
        $em->flush();

        return new JsonResponse(
            [
                'success' => true,
                'club' => [
                    'id' => $club->getId(),
                    'name' => $club->getName(),
                    'shortName' => $club->getShortName(),
                    'abbreviation' => $club->getAbbreviation(),
                    'stadiumName' => $club->getStadiumName(),
                    'website' => $club->getWebsite(),
                    'logoUrl' => $club->getLogoUrl(),
                    'email' => $club->getEmail(),
                    'phone' => $club->getPhone(),
                    'clubColors' => $club->getClubColors(),
                    'contactPerson' => $club->getContactPerson(),
                    'foundingYear' => $club->getFoundingYear(),
                    'active' => $club->isActive(),
                    'location' => [
                        'id' => $club->getLocation()?->getId(),
                        'name' => $club->getLocation()?->getName(),
                        'city' => $club->getLocation()?->getCity(),
                        'address' => $club->getLocation()?->getAddress(),
                        'latitude' => $club->getLocation()?->getLatitude(),
                        'longitude' => $club->getLocation()?->getLongitude(),
                        'surfaceType' => $club->getLocation()?->getSurfaceType() ? [
                            'id' => $club->getLocation()->getSurfaceType()->getId(),
                            'name' => $club->getLocation()->getSurfaceType()->getName(),
                        ] : null,
                    ]
                ],
                'permissions' => [
                    'canCreate' => $this->isGranted(ClubVoter::CREATE, $club),
                    'canEdit' => $this->isGranted(ClubVoter::EDIT, $club),
                    'canView' => $this->isGranted(ClubVoter::VIEW, $club),
                    'canDelete' => $this->isGranted(ClubVoter::DELETE, $club),
                ]
            ]
        );
    }

    #[Route('/clubs/{id}/delete', name: 'club_delete', methods: ['DELETE'])]
    public function delete(Club $club, EntityManagerInterface $em): JsonResponse
    {
        if (
            !$this->isGranted('ROLE_SUPERADMIN')
            || !$this->isGranted(ClubVoter::DELETE, $club)
        ) {
            return new JsonResponse(['error' => 'Unauthorized'], 403);
        }

        $em->remove($club);
        $em->flush();

        return new JsonResponse(['success' => true]);
    }

    #[Route('/clubs/{id}/detail-partial', name: 'club_detail_partial', methods: ['GET'])]
    public function detailPartial(Club $club): Response
    {
        return $this->render('club/_detail_content.html.twig', [
            'club' => $club,
        ]);
    }

    #[Route('/clubs/fussballde-lookup', name: 'club_fussballde_lookup', methods: ['GET'])]
    public function fussballdeLookup(Request $request, FussballDeCrawlerService $crawler): JsonResponse
    {
        $name = $request->query->get('name');
        if (!$name) {
            return new JsonResponse(['error' => 'Kein Name angegeben'], 400);
        }

        $teams = $crawler->searchTeams($name);
        if (!$teams || !isset($teams[0]['vereinId'])) {
            // Debug-Ausgabe: empfangener Name
            $debug = [
                'received_name' => $name,
            ];
            $debug['searchTeams_result'] = $teams;

            // Debug-Ausgabe bei Fehler
            return new JsonResponse([
                'error' => 'Kein Verein gefunden',
                'debug' => $debug
            ], 404);
        }

        $details = $crawler->retrieveVereinDetails($teams[0]['vereinId']);

        return new JsonResponse([
            'name' => $details['name'] ?? null,
            'website' => $details['website'] ?? null,
            'vereinId' => $details['vereinId'] ?? null,
            'url' => $details['url'] ?? null,
            'farben' => $details['farben'] ?? null,
            'gruendung' => $details['gruendung'] ?? null,
            'adresse' => $details['adresse'] ?? null,
            'ansprechpartner' => $details['ansprechpartner'] ?? null,
            'debug' => $details
        ]);
    }
}
