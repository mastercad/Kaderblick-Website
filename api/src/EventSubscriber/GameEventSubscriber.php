<?php

namespace App\EventSubscriber;

use App\Entity\Task;
use App\Event\GameCreatedEvent;
use App\Event\GameDeletedEvent;
use App\Service\TaskEventGeneratorService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class GameEventSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EntityManagerInterface $em,
        private TaskEventGeneratorService $taskEventGeneratorService,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            GameCreatedEvent::class => 'onGameCreated',
            GameDeletedEvent::class => 'onGameDeleted',
        ];
    }

    public function onGameCreated(GameCreatedEvent $event): void
    {
        $this->regeneratePerMatchTasks();
    }

    public function onGameDeleted(GameDeletedEvent $event): void
    {
        $this->regeneratePerMatchTasks();
    }

    private function regeneratePerMatchTasks(): void
    {
        $tasks = $this->em->getRepository(Task::class)->findBy(['recurrenceMode' => 'per_match']);

        foreach ($tasks as $task) {
            $this->taskEventGeneratorService->generateEvents($task, $task->getCreatedBy());
        }
    }
}
