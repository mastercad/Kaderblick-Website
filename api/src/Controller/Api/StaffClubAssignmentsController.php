<?php

namespace App\Controller\Api;

use App\Entity\StaffClubAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/staff-club-assignments', name: 'api_staff_club_assignments_')]
class StaffClubAssignmentsController extends ApiController
{
    protected string $entityName = 'StaffClubAssignment';
    protected string $entityNamePlural = 'StaffClubAssignments';
    protected string $entityClass = StaffClubAssignment::class;
    protected string $urlPart = 'staff-club-assignments';
    protected array $relations = [
        'user' => ['type' => 2, 'entityName' => 'User'],
        'club' => ['type' => 2, 'entityName' => 'Club'],
        'staffClubAssignmentType' => ['type' => 2, 'entityName' => 'StaffClubAssignmentType'],
    ];
}
