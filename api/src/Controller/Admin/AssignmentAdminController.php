<?php

namespace App\Controller\Admin;

use App\Entity\Club;
use App\Entity\FunctionaryClubAssignment;
use App\Entity\FunctionaryClubAssignmentType;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\FunctionaryTeamAssignmentType;
use App\Entity\StaffClubAssignment;
use App\Entity\StaffClubAssignmentType;
use App\Entity\StaffTeamAssignment;
use App\Entity\StaffTeamAssignmentType;
use App\Entity\Team;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/assignments', name: 'admin_assignments_')]
#[IsGranted('ROLE_SUPERADMIN')]
class AssignmentAdminController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    #[Route('/staff', name: 'staff', methods: ['GET'])]
    public function staff(): JsonResponse
    {
        $teamAssignments = $this->em->getRepository(StaffTeamAssignment::class)->findAll();
        $clubAssignments = $this->em->getRepository(StaffClubAssignment::class)->findAll();

        return $this->json([
            'teamAssignments' => array_map(fn (StaffTeamAssignment $a) => [
                'id' => $a->getId(),
                'user' => ['id' => $a->getUser()?->getId(), 'fullName' => $a->getUser()?->getFullName()],
                'team' => ['id' => $a->getTeam()?->getId(), 'name' => $a->getTeam()?->getName()],
                'type' => $a->getStaffTeamAssignmentType() ? ['id' => $a->getStaffTeamAssignmentType()->getId(), 'name' => $a->getStaffTeamAssignmentType()->getName()] : null,
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $teamAssignments),
            'clubAssignments' => array_map(fn (StaffClubAssignment $a) => [
                'id' => $a->getId(),
                'user' => ['id' => $a->getUser()?->getId(), 'fullName' => $a->getUser()?->getFullName()],
                'club' => ['id' => $a->getClub()?->getId(), 'name' => $a->getClub()?->getName()],
                'type' => $a->getStaffClubAssignmentType() ? ['id' => $a->getStaffClubAssignmentType()->getId(), 'name' => $a->getStaffClubAssignmentType()->getName()] : null,
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $clubAssignments),
            'users' => array_map(
                fn (User $u) => ['id' => $u->getId(), 'fullName' => $u->getFullName()],
                $this->em->getRepository(User::class)->findBy([], ['lastName' => 'ASC', 'firstName' => 'ASC'])
            ),
            'teams' => array_map(
                fn (Team $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $this->em->getRepository(Team::class)->findBy([], ['name' => 'ASC'])
            ),
            'clubs' => array_map(
                fn (Club $c) => ['id' => $c->getId(), 'name' => $c->getName()],
                $this->em->getRepository(Club::class)->findBy([], ['name' => 'ASC'])
            ),
            'teamAssignmentTypes' => array_map(
                fn (StaffTeamAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $this->em->getRepository(StaffTeamAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC'])
            ),
            'clubAssignmentTypes' => array_map(
                fn (StaffClubAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $this->em->getRepository(StaffClubAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC'])
            ),
        ]);
    }

    #[Route('/staff/team', name: 'staff_team_create', methods: ['POST'])]
    public function createStaffTeamAssignment(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $a = new StaffTeamAssignment();
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setTeam($this->em->getRepository(Team::class)->find($data['teamId']));
        if (!empty($data['typeId'])) {
            $a->setStaffTeamAssignmentType($this->em->getRepository(StaffTeamAssignmentType::class)->find($data['typeId']));
        }
        if (!empty($data['startDate'])) {
            $a->setStartDate(new DateTimeImmutable($data['startDate']));
        }
        if (!empty($data['endDate'])) {
            $a->setEndDate(new DateTimeImmutable($data['endDate']));
        }
        $this->em->persist($a);
        $this->em->flush();

        return $this->json(['success' => true, 'id' => $a->getId()]);
    }

    #[Route('/staff/team/{id}', name: 'staff_team_update', methods: ['PUT'])]
    public function updateStaffTeamAssignment(int $id, Request $request): JsonResponse
    {
        $a = $this->em->getRepository(StaffTeamAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $data = json_decode($request->getContent(), true);
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setTeam($this->em->getRepository(Team::class)->find($data['teamId']));
        $a->setStaffTeamAssignmentType(!empty($data['typeId']) ? $this->em->getRepository(StaffTeamAssignmentType::class)->find($data['typeId']) : null);
        $a->setStartDate(!empty($data['startDate']) ? new DateTimeImmutable($data['startDate']) : null);
        $a->setEndDate(!empty($data['endDate']) ? new DateTimeImmutable($data['endDate']) : null);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/staff/team/{id}', name: 'staff_team_delete', methods: ['DELETE'])]
    public function deleteStaffTeamAssignment(int $id): JsonResponse
    {
        $a = $this->em->getRepository(StaffTeamAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $this->em->remove($a);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/staff/club', name: 'staff_club_create', methods: ['POST'])]
    public function createStaffClubAssignment(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $a = new StaffClubAssignment();
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setClub($this->em->getRepository(Club::class)->find($data['clubId']));
        if (!empty($data['typeId'])) {
            $a->setStaffClubAssignmentType($this->em->getRepository(StaffClubAssignmentType::class)->find($data['typeId']));
        }
        if (!empty($data['startDate'])) {
            $a->setStartDate(new DateTimeImmutable($data['startDate']));
        }
        if (!empty($data['endDate'])) {
            $a->setEndDate(new DateTimeImmutable($data['endDate']));
        }
        $this->em->persist($a);
        $this->em->flush();

        return $this->json(['success' => true, 'id' => $a->getId()]);
    }

    #[Route('/staff/club/{id}', name: 'staff_club_update', methods: ['PUT'])]
    public function updateStaffClubAssignment(int $id, Request $request): JsonResponse
    {
        $a = $this->em->getRepository(StaffClubAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $data = json_decode($request->getContent(), true);
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setClub($this->em->getRepository(Club::class)->find($data['clubId']));
        $a->setStaffClubAssignmentType(!empty($data['typeId']) ? $this->em->getRepository(StaffClubAssignmentType::class)->find($data['typeId']) : null);
        $a->setStartDate(!empty($data['startDate']) ? new DateTimeImmutable($data['startDate']) : null);
        $a->setEndDate(!empty($data['endDate']) ? new DateTimeImmutable($data['endDate']) : null);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/staff/club/{id}', name: 'staff_club_delete', methods: ['DELETE'])]
    public function deleteStaffClubAssignment(int $id): JsonResponse
    {
        $a = $this->em->getRepository(StaffClubAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $this->em->remove($a);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/functionary', name: 'functionary', methods: ['GET'])]
    public function functionary(): JsonResponse
    {
        $teamAssignments = $this->em->getRepository(FunctionaryTeamAssignment::class)->findAll();
        $clubAssignments = $this->em->getRepository(FunctionaryClubAssignment::class)->findAll();

        return $this->json([
            'teamAssignments' => array_map(fn (FunctionaryTeamAssignment $a) => [
                'id' => $a->getId(),
                'user' => ['id' => $a->getUser()?->getId(), 'fullName' => $a->getUser()?->getFullName()],
                'team' => ['id' => $a->getTeam()?->getId(), 'name' => $a->getTeam()?->getName()],
                'type' => $a->getFunctionaryTeamAssignmentType() ?
                    ['id' => $a->getFunctionaryTeamAssignmentType()->getId(), 'name' => $a->getFunctionaryTeamAssignmentType()->getName()] : null,
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $teamAssignments),
            'clubAssignments' => array_map(fn (FunctionaryClubAssignment $a) => [
                'id' => $a->getId(),
                'user' => ['id' => $a->getUser()?->getId(), 'fullName' => $a->getUser()?->getFullName()],
                'club' => ['id' => $a->getClub()?->getId(), 'name' => $a->getClub()?->getName()],
                'type' => $a->getFunctionaryClubAssignmentType() ?
                    ['id' => $a->getFunctionaryClubAssignmentType()->getId(), 'name' => $a->getFunctionaryClubAssignmentType()->getName()] : null,
                'startDate' => $a->getStartDate()?->format('Y-m-d'),
                'endDate' => $a->getEndDate()?->format('Y-m-d'),
            ], $clubAssignments),
            'users' => array_map(
                fn (User $u) => ['id' => $u->getId(), 'fullName' => $u->getFullName()],
                $this->em->getRepository(User::class)->findBy([], ['lastName' => 'ASC', 'firstName' => 'ASC'])
            ),
            'teams' => array_map(
                fn (Team $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $this->em->getRepository(Team::class)->findBy([], ['name' => 'ASC'])
            ),
            'clubs' => array_map(
                fn (Club $c) => ['id' => $c->getId(), 'name' => $c->getName()],
                $this->em->getRepository(Club::class)->findBy([], ['name' => 'ASC'])
            ),
            'teamAssignmentTypes' => array_map(
                fn (FunctionaryTeamAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $this->em->getRepository(FunctionaryTeamAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC'])
            ),
            'clubAssignmentTypes' => array_map(
                fn (FunctionaryClubAssignmentType $t) => ['id' => $t->getId(), 'name' => $t->getName()],
                $this->em->getRepository(FunctionaryClubAssignmentType::class)->findBy(['active' => true], ['name' => 'ASC'])
            ),
        ]);
    }

    #[Route('/functionary/team', name: 'functionary_team_create', methods: ['POST'])]
    public function createFunctionaryTeamAssignment(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $a = new FunctionaryTeamAssignment();
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setTeam($this->em->getRepository(Team::class)->find($data['teamId']));
        if (!empty($data['typeId'])) {
            $a->setFunctionaryTeamAssignmentType($this->em->getRepository(FunctionaryTeamAssignmentType::class)->find($data['typeId']));
        }
        if (!empty($data['startDate'])) {
            $a->setStartDate(new DateTimeImmutable($data['startDate']));
        }
        if (!empty($data['endDate'])) {
            $a->setEndDate(new DateTimeImmutable($data['endDate']));
        }
        $this->em->persist($a);
        $this->em->flush();

        return $this->json(['success' => true, 'id' => $a->getId()]);
    }

    #[Route('/functionary/team/{id}', name: 'functionary_team_update', methods: ['PUT'])]
    public function updateFunctionaryTeamAssignment(int $id, Request $request): JsonResponse
    {
        $a = $this->em->getRepository(FunctionaryTeamAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $data = json_decode($request->getContent(), true);
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setTeam($this->em->getRepository(Team::class)->find($data['teamId']));
        $a->setFunctionaryTeamAssignmentType(!empty($data['typeId']) ? $this->em->getRepository(FunctionaryTeamAssignmentType::class)->find($data['typeId']) : null);
        $a->setStartDate(!empty($data['startDate']) ? new DateTimeImmutable($data['startDate']) : null);
        $a->setEndDate(!empty($data['endDate']) ? new DateTimeImmutable($data['endDate']) : null);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/functionary/team/{id}', name: 'functionary_team_delete', methods: ['DELETE'])]
    public function deleteFunctionaryTeamAssignment(int $id): JsonResponse
    {
        $a = $this->em->getRepository(FunctionaryTeamAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $this->em->remove($a);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/functionary/club', name: 'functionary_club_create', methods: ['POST'])]
    public function createFunctionaryClubAssignment(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $a = new FunctionaryClubAssignment();
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setClub($this->em->getRepository(Club::class)->find($data['clubId']));
        if (!empty($data['typeId'])) {
            $a->setFunctionaryClubAssignmentType($this->em->getRepository(FunctionaryClubAssignmentType::class)->find($data['typeId']));
        }
        if (!empty($data['startDate'])) {
            $a->setStartDate(new DateTimeImmutable($data['startDate']));
        }
        if (!empty($data['endDate'])) {
            $a->setEndDate(new DateTimeImmutable($data['endDate']));
        }
        $this->em->persist($a);
        $this->em->flush();

        return $this->json(['success' => true, 'id' => $a->getId()]);
    }

    #[Route('/functionary/club/{id}', name: 'functionary_club_update', methods: ['PUT'])]
    public function updateFunctionaryClubAssignment(int $id, Request $request): JsonResponse
    {
        $a = $this->em->getRepository(FunctionaryClubAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $data = json_decode($request->getContent(), true);
        $a->setUser($this->em->getRepository(User::class)->find($data['userId']));
        $a->setClub($this->em->getRepository(Club::class)->find($data['clubId']));
        $a->setFunctionaryClubAssignmentType(!empty($data['typeId']) ? $this->em->getRepository(FunctionaryClubAssignmentType::class)->find($data['typeId']) : null);
        $a->setStartDate(!empty($data['startDate']) ? new DateTimeImmutable($data['startDate']) : null);
        $a->setEndDate(!empty($data['endDate']) ? new DateTimeImmutable($data['endDate']) : null);
        $this->em->flush();

        return $this->json(['success' => true]);
    }

    #[Route('/functionary/club/{id}', name: 'functionary_club_delete', methods: ['DELETE'])]
    public function deleteFunctionaryClubAssignment(int $id): JsonResponse
    {
        $a = $this->em->getRepository(FunctionaryClubAssignment::class)->find($id);
        if (!$a) {
            return $this->json(['error' => 'Not found'], 404);
        }
        $this->em->remove($a);
        $this->em->flush();

        return $this->json(['success' => true]);
    }
}
