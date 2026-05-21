<?php

namespace App\Controller\Api;

use App\Entity\PlayerTeamAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/player-team-assignments', name: 'api_player_team_assignments_')]
class PlayerTeamAssignmentsController extends ApiController
{
    protected string $entityName = 'PlayerTeamAssignment';
    protected string $entityNamePlural = 'PlayerTeamAssignments';
    protected string $entityClass = PlayerTeamAssignment::class;
    protected string $urlPart = 'player-team-assignments';
    protected array $relations = [
        'player' => ['type' => 2, 'entityName' => 'Player'],
        'team' => ['type' => 2, 'entityName' => 'Team'],
        'playerTeamAssignmentType' => ['type' => 2, 'entityName' => 'PlayerTeamAssignmentType'],
    ];
}
