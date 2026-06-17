<?php

namespace App\Controller\Api;

use App\Entity\StaffTeamAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/staff-team-assignments', name: 'api_staff_team_assignments_')]
class StaffTeamAssignmentsController extends ApiController
{
    protected string $entityName = 'StaffTeamAssignment';
    protected string $entityNamePlural = 'StaffTeamAssignments';
    protected string $entityClass = StaffTeamAssignment::class;
    protected string $urlPart = 'staff-team-assignments';
    protected array $relations = [
        'user' => ['type' => 2, 'entityName' => 'User'],
        'team' => ['type' => 2, 'entityName' => 'Team'],
        'staffTeamAssignmentType' => ['type' => 2, 'entityName' => 'StaffTeamAssignmentType'],
    ];
}
