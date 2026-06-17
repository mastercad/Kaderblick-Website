<?php

namespace App\Controller\Api;

use App\Entity\FunctionaryClubAssignment;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/functionary-club-assignments', name: 'api_functionary_club_assignments_')]
class FunctionaryClubAssignmentsController extends ApiController
{
    protected string $entityName = 'FunctionaryClubAssignment';
    protected string $entityNamePlural = 'FunctionaryClubAssignments';
    protected string $entityClass = FunctionaryClubAssignment::class;
    protected string $urlPart = 'functionary-club-assignments';
    protected array $relations = [
        'user' => ['type' => 2, 'entityName' => 'User'],
        'club' => ['type' => 2, 'entityName' => 'Club'],
        'functionaryClubAssignmentType' => ['type' => 2, 'entityName' => 'FunctionaryClubAssignmentType'],
    ];
}
