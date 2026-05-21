<?php

namespace App\Controller\Api;

use App\Entity\PlayerClubAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/player-club-assignments', name: 'api_player_club_assignments_')]
class PlayerClubAssignmentsController extends ApiController
{
    protected string $entityName = 'PlayerClubAssignment';
    protected string $entityNamePlural = 'PlayerClubAssignments';
    protected string $entityClass = PlayerClubAssignment::class;
    protected string $urlPart = 'player-club-assignments';
    protected array $relations = [
        'player' => ['type' => 2, 'entityName' => 'Player'],
        'club' => ['type' => 2, 'entityName' => 'Club']
    ];
}
