<?php

namespace App\Controller\Api;

use App\Entity\FunctionaryTeamAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/functionary-team-assignments', name: 'api_functionary_team_assignments_')]
class FunctionaryTeamAssignmentsController extends ApiController
{
    protected string $entityName = 'FunctionaryTeamAssignment';
    protected string $entityNamePlural = 'FunctionaryTeamAssignments';
    protected string $entityClass = FunctionaryTeamAssignment::class;
    protected string $urlPart = 'functionary-team-assignments';
    protected array $relations = [
        'user' => ['type' => 2, 'entityName' => 'User'],
        'team' => ['type' => 2, 'entityName' => 'Team'],
        'functionaryTeamAssignmentType' => ['type' => 2, 'entityName' => 'FunctionaryTeamAssignmentType'],
    ];
}
