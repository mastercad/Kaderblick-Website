<?php

namespace App\Controller\Api;

use App\Entity\CoachTeamAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/coach-team-assignments', name: 'api_coach_team_assignments_')]
class CoachTeamAssignmentsController extends ApiController
{
    protected string $entityName = 'CoachTeamAssignment';
    protected string $entityNamePlural = 'CoachTeamAssignments';
    protected string $entityClass = CoachTeamAssignment::class;
    protected string $urlPart = 'coach-team-assignments';
    protected array $relations = [
        'coach' => ['type' => 2, 'entityName' => 'Coach'],
        'team' => ['type' => 2, 'entityName' => 'Team'],
        'coachTeamAssignmentType' => ['type' => 2, 'entityName' => 'CoachTeamAssignmentType'],
    ];
}
