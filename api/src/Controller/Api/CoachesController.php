<?php

namespace App\Controller\Api;

use App\Entity\Club;
use App\Entity\Coach;
use App\Entity\CoachClubAssignment;
use App\Entity\CoachLicense;
use App\Entity\CoachLicenseAssignment;
use App\Entity\CoachNationalityAssignment;
use App\Entity\CoachTeamAssignment;
use App\Entity\CoachTeamAssignmentType;
use App\Entity\Nationality;
use App\Entity\Team;
use App\Repository\CoachClubAssignmentRepository;
use App\Repository\CoachLicenseAssignmentRepository;
use App\Repository\CoachNationalityAssignmentRepository;
use App\Repository\CoachTeamAssignmentRepository;
use App\Security\Voter\CoachVoter;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route(path: '/api/coaches', name: 'api_coaches_')]
#[IsGranted('IS_AUTHENTICATED')]
class CoachesController extends AbstractController
{
    public function __construct(private EntityManagerInterface $entityManager)
    {
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 25)));
        $search = trim((string) $request->query->get('search', ''));
        $teamId = $request->query->get('teamId');

        $repo = $this->entityManager->getRepository(Coach::class);
        $qb = $repo->createQueryBuilder('c');

        // Filter by team
        if ($teamId) {
            $qb->innerJoin('c.coachTeamAssignments', 'cta')
               ->andWhere('cta.team = :teamId')
               ->setParameter('teamId', (int) $teamId);
        }

        // Filter by search (firstName / lastName)
        if ('' !== $search) {
            $qb->andWhere('LOWER(c.firstName) LIKE :search OR LOWER(c.lastName) LIKE :search')
               ->setParameter('search', '%' . strtolower($search) . '%');
        }

        // Count total matching results
        $countQb = clone $qb;
        $countQb->select('COUNT(DISTINCT c.id)');
        $total = (int) $countQb->getQuery()->getSingleScalarResult();

        // Fetch paginated results
        $offset = ($page - 1) * $limit;
        $qb->select('c')
           ->groupBy('c.id')
           ->orderBy('c.lastName', 'ASC')
           ->addOrderBy('c.firstName', 'ASC')
           ->setFirstResult($offset)
           ->setMaxResults($limit);

        $coaches = $qb->getQuery()->getResult();

        // Permissions: VIEW always true for logged-in users, CREATE/EDIT/DELETE require ROLE_ADMIN
        $isAdmin = $this->isGranted('ROLE_ADMIN') || $this->isGranted('ROLE_SUPERADMIN');

        return $this->json([
            'coaches' => array_map(fn ($coach) => [
                'id' => $coach->getId(),
                'firstName' => $coach->getFirstName(),
                'lastName' => $coach->getLastName(),
                'email' => $coach->getEmail(),
                'birthdate' => $coach->getBirthdate()?->format('Y-m-d'),
                'clubAssignments' => $coach->getCoachClubAssignments()->map(fn (CoachClubAssignment $coachClubAssignment) => [
                    'id' => $coachClubAssignment->getId(),
                    'startDate' => $coachClubAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachClubAssignment->getEndDate()?->format('Y-m-d'),
                    'club' => [
                        'id' => $coachClubAssignment->getClub()->getId(),
                        'name' => $coachClubAssignment->getClub()->getName(),
                    ]
                ])->toArray(),
                'teamAssignments' => $coach->getCoachTeamAssignments()->map(fn (CoachTeamAssignment $coachTeamAssignment) => [
                    'id' => $coachTeamAssignment->getId(),
                    'startDate' => $coachTeamAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachTeamAssignment->getEndDate()?->format('Y-m-d'),
                    'team' => [
                        'id' => $coachTeamAssignment->getTeam()->getId(),
                        'name' => $coachTeamAssignment->getTeam()->getName(),
                        'ageGroup' => [
                            'id' => $coachTeamAssignment->getTeam()->getAgeGroup()->getId(),
                            'name' => $coachTeamAssignment->getTeam()->getAgeGroup()->getName()
                        ],
                        'league' => [
                            'id' => $coachTeamAssignment->getTeam()->getLeague()->getId(),
                            'name' => $coachTeamAssignment->getTeam()->getLeague()->getName()
                        ],
                        'type' => [
                            'id' => $coachTeamAssignment->getCoachTeamAssignmentType()?->getId(),
                            'name' => $coachTeamAssignment->getCoachTeamAssignmentType()?->getName()
                        ]
                    ]
                ])->toArray(),
                'licenseAssignments' => $coach->getCoachLicenseAssignments()->map(fn (CoachLicenseAssignment $coachLicenseAssignment) => [
                    'id' => $coachLicenseAssignment->getLicense()->getId(),
                    'name' => $coachLicenseAssignment->getLicense()->getName(),
                    'startDate' => $coachLicenseAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachLicenseAssignment->getEndDate()?->format('Y-m-d'),
                    'license' => [
                        'id' => $coachLicenseAssignment->getLicense()->getId(),
                        'name' => $coachLicenseAssignment->getLicense()->getName()
                    ]
                ])->toArray(),
                'nationalityAssignments' => $coach->getCoachNationalityAssignments()->map(fn (CoachNationalityAssignment $coachNationalityAssignment) => [
                    'id' => $coachNationalityAssignment->getId(),
                    'startDate' => $coachNationalityAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachNationalityAssignment->getEndDate()?->format('Y-m-d'),
                    'nationality' => [
                        'id' => $coachNationalityAssignment->getNationality()->getId(),
                        'name' => $coachNationalityAssignment->getNationality()->getName(),
                    ]
                ])->toArray(),
                'permissions' => [
                    'canEdit' => $isAdmin,
                    'canDelete' => $isAdmin,
                    'canView' => true,
                    'canCreate' => $isAdmin,
                ]
            ], $coaches),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
        ]);
    }

    #[Route('/{id}', name: 'show', methods: ['GET'])]
    public function show(Coach $coach): JsonResponse
    {
        if (!$this->isGranted(CoachVoter::VIEW, $coach)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        return $this->json([
            'coach' => [
                'id' => $coach->getId(),
                'firstName' => $coach->getFirstName(),
                'lastName' => $coach->getLastName(),
                'email' => $coach->getEmail(),
                'birthdate' => $coach->getBirthdate()?->format('Y-m-d'),
                'clubAssignments' => $coach->getCoachClubAssignments()->map(fn (CoachClubAssignment $coachClubAssignment) => [
                    'id' => $coachClubAssignment->getId(),
                    'startDate' => $coachClubAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachClubAssignment->getEndDate()?->format('Y-m-d'),
                    'club' => [
                        'id' => $coachClubAssignment->getClub()->getId(),
                        'name' => $coachClubAssignment->getClub()->getName(),
                    ]
                ])->toArray(),
                'teamAssignments' => $coach->getCoachTeamAssignments()->map(fn (CoachTeamAssignment $coachTeamAssignment) => [
                    'id' => $coachTeamAssignment->getId(),
                    'startDate' => $coachTeamAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachTeamAssignment->getEndDate()?->format('Y-m-d'),
                    'team' => [
                        'id' => $coachTeamAssignment->getTeam()->getId(),
                        'name' => $coachTeamAssignment->getTeam()->getName(),
                        'ageGroup' => [
                            'id' => $coachTeamAssignment->getTeam()->getAgeGroup()->getId(),
                            'name' => $coachTeamAssignment->getTeam()->getAgeGroup()->getName()
                        ],
                        'league' => [
                            'id' => $coachTeamAssignment->getTeam()->getLeague()->getId(),
                            'name' => $coachTeamAssignment->getTeam()->getLeague()->getName()
                        ],
                        'type' => [
                            'id' => $coachTeamAssignment->getCoachTeamAssignmentType()?->getId(),
                            'name' => $coachTeamAssignment->getCoachTeamAssignmentType()?->getName()
                        ],
                    ]
                ])->toArray(),
                'licenseAssignments' => $coach->getCoachLicenseAssignments()->map(fn (CoachLicenseAssignment $coachLicenseAssignment) => [
                    'id' => $coachLicenseAssignment->getId(),
                    'name' => $coachLicenseAssignment->getLicense()->getName(),
                    'startDate' => $coachLicenseAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachLicenseAssignment->getEndDate()?->format('Y-m-d'),
                    'license' => [
                        'id' => $coachLicenseAssignment->getLicense()->getId(),
                        'name' => $coachLicenseAssignment->getLicense()->getName()
                    ]
                ])->toArray(),
                'nationalityAssignments' => $coach->getCoachNationalityAssignments()->map(fn (CoachNationalityAssignment $coachNationalityAssignment) => [
                    'id' => $coachNationalityAssignment->getId(),
                    'startDate' => $coachNationalityAssignment->getStartDate()?->format('Y-m-d'),
                    'endDate' => $coachNationalityAssignment->getEndDate()?->format('Y-m-d'),
                    'nationality' => [
                        'id' => $coachNationalityAssignment->getNationality()->getId(),
                        'name' => $coachNationalityAssignment->getNationality()->getName(),
                    ]
                ])->toArray(),
                'permissions' => [
                    'canEdit' => $this->isGranted(CoachVoter::EDIT, $coach),
                    'canDelete' => $this->isGranted(CoachVoter::DELETE, $coach),
                    'canView' => $this->isGranted(CoachVoter::VIEW, $coach),
                    'canCreate' => $this->isGranted(CoachVoter::CREATE, $coach)
                ]
            ]
        ]);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $coach = new Coach();

        if (!$this->isGranted(CoachVoter::CREATE, $coach)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);
        $coach->setFirstName($data['firstName']);
        $coach->setLastName($data['lastName']);
        $coach->setEmail($data['email'] ?? '');
        $coach->setBirthdate(isset($data['birthdate']) ? new DateTime($data['birthdate']) : null);

        foreach (($data['clubAssignments'] ?? []) as $clubAssignment) {
            $club = $this->entityManager->getRepository(Club::class)->find($clubAssignment['club']['id']);
            $coachClubAssignment = new CoachClubAssignment();
            $coachClubAssignment->setCoach($coach);
            $coachClubAssignment->setStartDate(isset($clubAssignment['startDate']) ? new DateTime($clubAssignment['startDate']) : null);
            $coachClubAssignment->setEndDate((isset($clubAssignment['endDate'])
                && !empty($clubAssignment['endDate'])) ? new DateTime($clubAssignment['endDate']) : null);
            $coachClubAssignment->setClub($club);

            $this->entityManager->persist($coachClubAssignment);
        }

        foreach (($data['licenseAssignments'] ?? []) as $licenseAssignment) {
            $license = $this->entityManager->getRepository(CoachLicense::class)->find($licenseAssignment['license']['id']);
            $coachLicenseAssignment = new CoachLicenseAssignment();
            $coachLicenseAssignment->setCoach($coach);
            $coachLicenseAssignment->setStartDate(isset($licenseAssignment['startDate']) ? new DateTime($licenseAssignment['startDate']) : null);
            $coachLicenseAssignment->setEndDate((isset($licenseAssignment['endDate'])
                && !empty($licenseAssignment['endDate'])) ? new DateTime($licenseAssignment['endDate']) : null);
            $coachLicenseAssignment->setLicense($license);

            $this->entityManager->persist($coachLicenseAssignment);
        }

        foreach (($data['nationalityAssignments'] ?? []) as $nationalityAssignment) {
            $nationality = $this->entityManager->getRepository(Nationality::class)->find($nationalityAssignment['nationality']['id']);
            $coachNationalityAssignment = new CoachNationalityAssignment();
            $coachNationalityAssignment->setCoach($coach);
            $coachNationalityAssignment->setStartDate(isset($nationalityAssignment['startDate']) ? new DateTime($nationalityAssignment['startDate']) : null);
            $coachNationalityAssignment->setEndDate((isset($nationalityAssignment['endDate'])
                && !empty($nationalityAssignment['endDate'])) ? new DateTime($nationalityAssignment['endDate']) : null);
            $coachNationalityAssignment->setNationality($nationality);

            $this->entityManager->persist($coachNationalityAssignment);
        }

        foreach (($data['teamAssignments'] ?? []) as $teamAssignment) {
            $team = $this->entityManager->getRepository(Team::class)->find($teamAssignment['team']['id']);
            $coachTeamAssignment = new CoachTeamAssignment();
            $coachTeamAssignment->setCoach($coach);
            $coachTeamAssignment->setStartDate(isset($teamAssignment['startDate']) ? new DateTime($teamAssignment['startDate']) : null);
            $coachTeamAssignment->setEndDate((isset($teamAssignment['endDate'])
                && !empty($teamAssignment['endDate'])) ? new DateTime($teamAssignment['endDate']) : null);
            $coachTeamAssignment->setTeam($team);

            $type = $this->entityManager->getRepository(CoachTeamAssignmentType::class)->find($teamAssignment['type'] ?? null);
            $coachTeamAssignment->setCoachTeamAssignmentType($type);

            $this->entityManager->persist($coachTeamAssignment);
        }

        $this->entityManager->persist($coach);
        $this->entityManager->flush();

        return $this->json(['success' => true], Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(Coach $coach, Request $request): JsonResponse
    {
        if (!$this->isGranted(CoachVoter::EDIT, $coach)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        $coach->setFirstName($data['firstName']);
        $coach->setLastName($data['lastName']);
        $coach->setEmail($data['email'] ?? '');
        $coach->setBirthdate(isset($data['birthdate']) ? new DateTime($data['birthdate']) : null);

        $existingCoachLicenseAssignments = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(CoachLicenseAssignment::class)->findBy(['coach' => $coach])
        );
        $existingCoachNationalities = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(CoachNationalityAssignment::class)->findBy(['coach' => $coach])
        );
        $existingCoachTeams = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(CoachTeamAssignment::class)->findBy(['coach' => $coach])
        );
        $existingCoachClubAssignments = array_map(
            fn ($assignment) => $assignment->getId(),
            $this->entityManager->getRepository(CoachClubAssignment::class)->findBy(['coach' => $coach])
        );

        foreach (($data['clubAssignments'] ?? []) as $clubAssignment) {
            if (isset($clubAssignment['id']) && isset($clubAssignment['club']) && in_array($clubAssignment['id'], $existingCoachClubAssignments)) {
                $existingCoachClubAssignments = array_filter($existingCoachClubAssignments, fn ($id) => $id !== $clubAssignment['id']);
            }
            if (isset($clubAssignment['id'])) {
                $coachClubAssignment = $this->entityManager->getRepository(CoachClubAssignment::class)->find((int) $clubAssignment['id']);
            } else {
                $coachClubAssignment = new CoachClubAssignment();
            }

            $club = $this->entityManager->getRepository(Club::class)->find($clubAssignment['club']['id']);
            $coachClubAssignment->setCoach($coach);
            $coachClubAssignment->setStartDate(isset($clubAssignment['startDate']) ? new DateTime($clubAssignment['startDate']) : null);
            $coachClubAssignment->setEndDate((isset($clubAssignment['endDate'])
                && !empty($clubAssignment['endDate'])) ? new DateTime($clubAssignment['endDate']) : null);
            $coachClubAssignment->setClub($club);

            $this->entityManager->persist($coachClubAssignment);
        }

        /** @var CoachClubAssignmentRepository $coachClubAssignmentRepository */
        $coachClubAssignmentRepository = $this->entityManager->getRepository(CoachClubAssignment::class);
        $coachClubAssignmentRepository->deleteByIds($existingCoachClubAssignments);

        foreach (($data['licenseAssignments'] ?? []) as $licenseAssignment) {
            if (
                isset($licenseAssignment['id'])
                && isset($licenseAssignment['license'])
                && in_array($licenseAssignment['id'], $existingCoachLicenseAssignments)
            ) {
                $existingCoachLicenseAssignments = array_filter($existingCoachLicenseAssignments, fn ($id) => $id !== $licenseAssignment['id']);
            }
            if (isset($licenseAssignment['id'])) {
                $coachLicenseAssignment = $this->entityManager->getRepository(CoachLicenseAssignment::class)->find((int) $licenseAssignment['id']);
            } else {
                $coachLicenseAssignment = new CoachLicenseAssignment();
            }

            $license = $this->entityManager->getRepository(CoachLicense::class)->find($licenseAssignment['license']['id']);
            $coachLicenseAssignment->setCoach($coach);
            $coachLicenseAssignment->setStartDate(isset($licenseAssignment['startDate']) ? new DateTime($licenseAssignment['startDate']) : null);
            $coachLicenseAssignment->setEndDate((isset($licenseAssignment['endDate'])
                && !empty($licenseAssignment['endDate'])) ? new DateTime($licenseAssignment['endDate']) : null);
            $coachLicenseAssignment->setLicense($license);

            $this->entityManager->persist($coachLicenseAssignment);
        }

        /** @var CoachLicenseAssignmentRepository $coachLicenseAssignmentRepository */
        $coachLicenseAssignmentRepository = $this->entityManager->getRepository(CoachLicenseAssignment::class);
        $coachLicenseAssignmentRepository->deleteByIds($existingCoachLicenseAssignments);

        foreach (($data['nationalityAssignments'] ?? []) as $nationalityAssignment) {
            if (
                isset($nationalityAssignment['id'])
                && isset($nationalityAssignment['nationality'])
                && in_array($nationalityAssignment['id'], $existingCoachNationalities)
            ) {
                $existingCoachNationalities = array_filter($existingCoachNationalities, fn ($id) => $id !== $nationalityAssignment['id']);
            }
            if (isset($nationalityAssignment['id'])) {
                $coachNationalityAssignment = $this->entityManager->getRepository(CoachNationalityAssignment::class)->find((int) $nationalityAssignment['id']);
            } else {
                $coachNationalityAssignment = new CoachNationalityAssignment();
            }

            $nationality = $this->entityManager->getRepository(Nationality::class)->find($nationalityAssignment['nationality']['id']);
            $coachNationalityAssignment->setCoach($coach);
            $coachNationalityAssignment->setStartDate(isset($nationalityAssignment['startDate']) ? new DateTime($nationalityAssignment['startDate']) : null);
            $coachNationalityAssignment->setEndDate((isset($nationalityAssignment['endDate'])
                && !empty($nationalityAssignment['endDate'])) ? new DateTime($nationalityAssignment['endDate']) : null);
            $coachNationalityAssignment->setNationality($nationality);

            $this->entityManager->persist($coachNationalityAssignment);
        }

        /** @var CoachNationalityAssignmentRepository $coachNationalityAssignmentRepository */
        $coachNationalityAssignmentRepository = $this->entityManager->getRepository(CoachNationalityAssignment::class);
        $coachNationalityAssignmentRepository->deleteByIds($existingCoachNationalities);

        foreach (($data['teamAssignments'] ?? []) as $teamAssignment) {
            if (
                isset($teamAssignment['id'])
                && isset($teamAssignment['team'])
                && in_array($teamAssignment['id'], $existingCoachTeams)
            ) {
                $existingCoachTeams = array_filter($existingCoachTeams, fn ($id) => $id !== $teamAssignment['id']);
            }

            $team = $this->entityManager->getRepository(Team::class)->find($teamAssignment['team']['id']);
            if (isset($teamAssignment['id'])) {
                $coachTeamAssignment = $this->entityManager->getRepository(CoachTeamAssignment::class)->find((int) $teamAssignment['id']);
            } else {
                $coachTeamAssignment = new CoachTeamAssignment();
            }
            $coachTeamAssignment->setCoach($coach);
            $coachTeamAssignment->setStartDate(isset($teamAssignment['startDate']) ? new DateTime($teamAssignment['startDate']) : null);
            $coachTeamAssignment->setEndDate((isset($teamAssignment['endDate'])
                && !empty($teamAssignment['endDate'])) ? new DateTime($teamAssignment['endDate']) : null);
            $coachTeamAssignment->setTeam($team);

            $type = $this->entityManager->getRepository(CoachTeamAssignmentType::class)->find($teamAssignment['type'] ?? null);
            $coachTeamAssignment->setCoachTeamAssignmentType($type);

            $this->entityManager->persist($coachTeamAssignment);
        }

        /** @var CoachTeamAssignmentRepository $coachTeamAssignmentRepository */
        $coachTeamAssignmentRepository = $this->entityManager->getRepository(CoachTeamAssignment::class);
        $coachTeamAssignmentRepository->deleteByIds($existingCoachTeams);

        $this->entityManager->persist($coach);
        $this->entityManager->flush();

        return $this->json(['success' => true], Response::HTTP_CREATED);
    }

    #[Route(path: '/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Coach $coach): JsonResponse
    {
        if (!$this->isGranted(CoachVoter::DELETE, $coach)) {
            return $this->json(['error' => 'Zugriff verweigert'], Response::HTTP_FORBIDDEN);
        }

        $this->entityManager->remove($coach);

        $coachClubAssignments = $this->entityManager->getRepository(CoachClubAssignment::class)->findBy(['coach' => $coach]);
        foreach ($coachClubAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }

        $coachTeamAssignments = $this->entityManager->getRepository(CoachTeamAssignment::class)->findBy(['coach' => $coach]);
        foreach ($coachTeamAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }

        $coachLicenseAssignments = $this->entityManager->getRepository(CoachLicenseAssignment::class)->findBy(['coach' => $coach]);
        foreach ($coachLicenseAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }

        $coachNationalityAssignments = $this->entityManager->getRepository(CoachNationalityAssignment::class)->findBy(['coach' => $coach]);
        foreach ($coachNationalityAssignments as $assignment) {
            $this->entityManager->remove($assignment);
        }
        $this->entityManager->flush();

        return $this->json(['success' => true]);
    }
}
