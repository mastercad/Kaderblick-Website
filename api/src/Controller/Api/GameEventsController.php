<?php

namespace App\Controller\Api;

use App\Entity\GameEvent;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/game-events', name: 'api_game_events_')]
class GameEventsController extends ApiController
{
    protected string $entityName = 'GameEvent';
    protected string $entityNamePlural = 'GameEvents';
    protected string $entityClass = GameEvent::class;
    protected string $urlPart = 'game-events';
    protected array $relations = [
        'game' => ['type' => 2, 'entityName' => 'Game'],
        'gameEventType' => ['type' => 2, 'entityName' => 'GameEventType'],
        'player' => ['type' => 2, 'entityName' => 'Player'],
        'relatedPlayer' => ['type' => 2, 'entityName' => 'Player', 'fieldName' => 'relatedPlayer', 'methodName' => 'relatedPlayer'],
        'team' => ['type' => 2, 'entityName' => 'Team'],
        'substitutionReason' => ['type' => 2, 'entityName' => 'SubstitutionReason']
    ];
}
