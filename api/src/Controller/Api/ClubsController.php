<?php

namespace App\Controller\Api;

use App\Entity\Club;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/clubs', name: 'api_clubs_')]
class ClubsController extends ApiController
{
    protected string $entityName = 'Club';
    protected string $entityNamePlural = 'Clubs';
    protected string $entityClass = Club::class;
    protected string $urlPart = 'clubs';
    protected array $relations = [
        'teams' => [
            'type' => 4,
            'entityName' => 'Team',
            'label_fields' => ['name', 'ageGroup.name']
        ],
        'location' => ['type' => 2, 'entityName' => 'Location'],
        'playerClubAssignments' => [
            'type' => 4,
            'entityName' => 'PlayerClubAssignment',
            'label_fields' => ['player.firstName', 'player.lastName']
        ],
        'coachClubAssignments' => [
            'type' => 4,
            'entityName' => 'CoachClubAssignment',
            'label_fields' => ['coach.firstName', 'coach.lastName']
        ]
    ];
}
