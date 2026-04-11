<?php

namespace Tests\Feature;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Event\GameCreatedEvent;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TaskRotationIntegrationTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();
    }

    protected function tearDown(): void
    {
        $this->em->getConnection()->rollBack();
        parent::tearDown();
        restore_exception_handler();
    }

    private function loadAdminUser(): User
    {
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($user, 'Fixture admin user user16@example.com not found. Please load fixtures.');

        return $user;
    }

    public function testTaskCreationWithMultipleUsersCreatesRotationCorrectly(): void
    {
        $client = $this->client;
        $adminUser = $this->loadAdminUser();

        $ageGroup = $this->getOrCreateAgeGroup($this->em);

        $team = new Team();
        $team->setName('Test Team 1');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);
        $this->em->flush(); // Flush team first

        $user1 = $this->createUserWithPlayer($this->em, 'test-task-user1@example.com', 'User', 'One', $team);
        $user2 = $this->createUserWithPlayer($this->em, 'test-task-user2@example.com', 'User', 'Two', $team);

        for ($i = 1; $i <= 3; ++$i) {
            $this->createGame($this->em, $team, "Test Game {$i}", "+{$i} week");
        }

        $this->em->flush(); // Flush games

        $client->loginUser($adminUser);
        $client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Torwart',
            'description' => 'Torwart Aufgabe',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user1->getId(), $user2->getId()],
            'rotationCount' => 1,
        ]));

        if (201 !== $client->getResponse()->getStatusCode()) {
            dump($client->getResponse()->getContent());
        }

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Torwart']);

        $this->assertNotNull($task);
        $this->assertEquals('per_match', $task->getRecurrenceMode());
        $this->assertCount(2, $task->getRotationUsers());

        $assignmentRepo = $this->em->getRepository(TaskAssignment::class);
        $assignments = $assignmentRepo->findBy(['task' => $task], ['id' => 'ASC']);

        $this->assertCount(3, $assignments, 'Should have task assignments for 3 games');
        usort($assignments, fn ($a, $b) => $a->getTask()->getAssignedDate()?->getTimestamp() <=> $b->getTask()->getAssignedDate()?->getTimestamp());
        $calendarEvents = array_filter(array_map(fn ($a) => $a->getCalendarEvent(), $assignments));
        usort($calendarEvents, fn ($a, $b) => $a->getStartDate()->getTimestamp() <=> $b->getStartDate()->getTimestamp());
        $this->assertCount(3, $calendarEvents, 'Should have 3 calendar events for 3 games');

        // Verify rotation is applied — both users should appear across the 3 assignments
        $assignedUserIds = array_map(fn ($a) => $a->getUser()->getId(), $assignments);
        $this->assertContains($user1->getId(), $assignedUserIds, 'user1 should be assigned at least once');
        $this->assertContains($user2->getId(), $assignedUserIds, 'user2 should be assigned at least once');
    }

    public function testNewGameCreationTriggersTaskRegeneration(): void
    {
        $client = $this->client;
        $adminUser = $this->loadAdminUser();

        $ageGroup = $this->getOrCreateAgeGroup($this->em);

        $team = new Team();
        $team->setName('Test Team 2');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $user = $this->createUserWithPlayer($this->em, 'test-task-user3@example.com', 'User', 'Three', $team);
        $this->createGame($this->em, $team, 'Test Game Initial', '+1 week');

        $this->em->flush();

        $client->loginUser($adminUser);
        $client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Auto Update',
            'description' => 'Should auto-update',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Auto Update']);

        $this->assertNotNull($task, 'Template task should be created by POST /api/tasks');

        // Find assignments linked to occurrences of this template
        $initialAssignments = $this->getAssignmentsForTemplate($task, $this->em);

        $this->assertCount(1, $initialAssignments);

        // Create a new game directly and dispatch event
        // Re-fetch team from DB after clear
        $team = $this->em->getRepository(Team::class)->find($team->getId());
        $game2 = $this->createGame($this->em, $team, 'Test Game New', '+2 weeks');
        $this->em->flush();

        // Dispatch GameCreatedEvent manually to trigger task regeneration
        $eventDispatcher = static::getContainer()->get('event_dispatcher');
        $gameCreatedEvent = new GameCreatedEvent($game2);
        $eventDispatcher->dispatch($gameCreatedEvent);

        $this->em->clear();

        // Re-fetch repositories after clear
        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Auto Update']);

        // Find assignments linked to occurrences of this template
        $updatedAssignments = $this->getAssignmentsForTemplate($task, $this->em);
        $this->assertCount(2, $updatedAssignments, 'Should have 2 assignments after new game creation');
    }

    public function testGameDeletionTriggersTaskRegeneration(): void
    {
        $client = $this->client;
        $adminUser = $this->loadAdminUser();

        $ageGroup = $this->getOrCreateAgeGroup($this->em);

        $team = new Team();
        $team->setName('Test Team 3');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $user = $this->createUserWithPlayer($this->em, 'test-task-user4@example.com', 'User', 'Four', $team);

        $game1 = $this->createGame($this->em, $team, 'Test Game Del 1', '+1 week');
        $game2 = $this->createGame($this->em, $team, 'Test Game Del 2', '+2 weeks');

        $this->em->flush();

        $client->loginUser($adminUser);
        $client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Delete Game',
            'description' => 'Should handle deletion',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Delete Game']);

        $initialAssignments = $this->getAssignmentsForTemplate($task, $this->em);
        $this->assertCount(2, $initialAssignments);

        // Actually delete the game FIRST
        // Re-fetch game from DB after clear
        $game1 = $this->em->getRepository(Game::class)->find($game1->getId());
        $calendarEvent = $game1->getCalendarEvent();
        $this->em->remove($game1);
        $this->em->remove($calendarEvent);
        $this->em->flush();

        // THEN dispatch GameDeletedEvent to trigger task regeneration
        $eventDispatcher = static::getContainer()->get('event_dispatcher');
        $gameDeletedEvent = new \App\Event\GameDeletedEvent($game1);
        $eventDispatcher->dispatch($gameDeletedEvent);

        $this->em->clear();

        // Re-fetch repositories after clear
        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Delete Game']);

        $updatedAssignments = $this->getAssignmentsForTemplate($task, $this->em);
        $this->assertCount(1, $updatedAssignments, 'Should have 1 assignment after game deletion');
    }

    public function testTaskOnlyCreatedForUserTeams(): void
    {
        $client = $this->client;
        $adminUser = $this->loadAdminUser();

        $ageGroup = $this->getOrCreateAgeGroup($this->em);

        $team1 = new Team();
        $team1->setName('Test Team User');
        $team1->setAgeGroup($ageGroup);
        $this->em->persist($team1);

        $team2 = new Team();
        $team2->setName('Test Team Other');
        $team2->setAgeGroup($ageGroup);
        $this->em->persist($team2);

        $user = $this->createUserWithPlayer($this->em, 'test-task-user5@example.com', 'User', 'Five', $team1);

        $this->createGame($this->em, $team1, 'Test Game User Team', '+1 week');
        $this->createGame($this->em, $team2, 'Test Game Other Team', '+2 weeks');

        $this->em->flush();

        $client->loginUser($adminUser);
        $client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Team Filter',
            'description' => 'Only for user teams',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Team Filter']);

        $assignments = $this->getAssignmentsForTemplate($task, $this->em);

        $this->assertCount(2, $assignments, 'Should have assignments for both games');
    }

    /**
     * Reproduces the reported bug:
     * "Pro Spiel ein Task angelegt war, ich ein neues Spiel angelegt habe und nun sind es Pro Spiel 3 Tasks."
     *
     * Root-cause analysis: generateEvents() deletes only *future* assignments (assignedDate >= now),
     * but generatePerMatchOccurrences() re-creates assignments for *all* games since task.assignedDate —
     * including past games whose assignments were just preserved.  Every new game addition therefore
     * adds one more duplicate assignment for each past game.
     *
     * Expected behaviour: past game assignments are preserved unchanged; only future assignments are
     * regenerated.  After adding one new game there must be exactly 1 assignment per game.
     */
    public function testPastGameAssignmentIsNotDuplicatedWhenNewGameAdded(): void
    {
        $adminUser = $this->loadAdminUser();
        $ageGroup = $this->getOrCreateAgeGroup($this->em);

        $team = new Team();
        $team->setName('Dup-Test Team');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $rotationUser = $this->createUserWithPlayer($this->em, 'dup-test-rot@example.com', 'Dup', 'User', $team);

        // Past game that already happened (2 weeks ago).
        $pastGame = $this->createGame($this->em, $team, 'Past Game Dup Test', '-2 weeks');

        $aufgabeType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Aufgabe']);
        self::assertNotNull($aufgabeType, 'Aufgabe CalendarEventType must be loaded from fixtures');

        // Per-match task — assigned 4 weeks ago (before the past game).
        $task = new Task();
        $task->setTitle('Dup Test Per-Match Task');
        $task->setIsRecurring(true);
        $task->setRecurrenceMode('per_match');
        $task->setRotationCount(1);
        $task->setAssignedDate(new DateTimeImmutable('-4 weeks'));
        $task->setCreatedBy($adminUser);
        $task->addRotationUser($rotationUser);
        $this->em->persist($task);

        // Existing assignment for the past game (simulates state before the new game is added).
        $pastAufgabe = new CalendarEvent();
        $pastAufgabe->setTitle('Dup Test Per-Match Task - Dup User - Past Game Dup Test');
        $pastAufgabe->setStartDate(new DateTimeImmutable('-2 weeks'));
        $pastAufgabe->setEndDate(new DateTimeImmutable('-2 weeks +2 hours'));
        $pastAufgabe->setCalendarEventType($aufgabeType);
        $this->em->persist($pastAufgabe);

        $pastAssignment = new TaskAssignment();
        $pastAssignment->setTask($task);
        $pastAssignment->setUser($rotationUser);
        $pastAssignment->setSubstituteUser($adminUser);
        $pastAssignment->setAssignedDate(new DateTimeImmutable('-2 weeks'));
        $pastAssignment->setStatus('offen');
        $pastAssignment->setCalendarEvent($pastAufgabe);
        $this->em->persist($pastAssignment);
        $this->em->flush();

        // Pre-condition: exactly 1 assignment before the new game is added.
        $before = $this->getAssignmentsForTemplate($task, $this->em);
        $this->assertCount(1, $before, 'Pre-condition: should have 1 assignment for the past game');

        // Add a new future game and trigger rotation regeneration.
        $team = $this->em->getRepository(Team::class)->find($team->getId());
        $futureGame = $this->createGame($this->em, $team, 'Future Game Dup Test', '+1 week');

        $dispatcher = static::getContainer()->get('event_dispatcher');
        $dispatcher->dispatch(new GameCreatedEvent($futureGame));

        $this->em->clear();

        $task = $this->em->getRepository(Task::class)->findOneBy(['title' => 'Dup Test Per-Match Task']);
        $after = $this->getAssignmentsForTemplate($task, $this->em);

        // Each game must have exactly 1 assignment — no accumulation on the past game.
        $this->assertCount(
            2,
            $after,
            'After adding one new game there must be exactly 2 assignments total: '
            . '1 for the past game (preserved, NOT duplicated) and 1 for the new future game. '
            . 'Got ' . count($after) . '.'
        );

        $assignedDates = array_unique(
            array_map(static fn (TaskAssignment $a) => $a->getAssignedDate()->format('Y-m-d'), $after)
        );
        $this->assertCount(2, $assignedDates, 'No duplicate assignments per game: each game date must appear exactly once');
    }

    /**
     * Simulates the exact user scenario: one past game, then two new games added sequentially.
     * With the bug the past game accumulates 3 assignments ("Pro Spiel 3 Tasks").
     * The expected outcome is exactly 1 assignment per game (3 total).
     */
    public function testAssignmentCountStaysOnePerGameAfterMultipleNewGamesAdded(): void
    {
        $adminUser = $this->loadAdminUser();
        $ageGroup = $this->getOrCreateAgeGroup($this->em);

        $team = new Team();
        $team->setName('Multi-Dup-Test Team');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $rotationUser = $this->createUserWithPlayer(
            $this->em,
            'multi-dup-test-rot@example.com',
            'MultiDup',
            'User',
            $team
        );

        // Starting game — already in the past.
        $this->createGame($this->em, $team, 'Old Game Multi Dup', '-3 weeks');

        $aufgabeType = $this->em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Aufgabe']);
        self::assertNotNull($aufgabeType);

        // Per-match task created 5 weeks ago, before the old game.
        $task = new Task();
        $task->setTitle('Multi Dup Per-Match Task');
        $task->setIsRecurring(true);
        $task->setRecurrenceMode('per_match');
        $task->setRotationCount(1);
        $task->setAssignedDate(new DateTimeImmutable('-5 weeks'));
        $task->setCreatedBy($adminUser);
        $task->addRotationUser($rotationUser);
        $this->em->persist($task);

        // Existing assignment for the old game.
        $oldAufgabe = new CalendarEvent();
        $oldAufgabe->setTitle('Multi Dup Per-Match Task - MultiDup User - Old Game Multi Dup');
        $oldAufgabe->setStartDate(new DateTimeImmutable('-3 weeks'));
        $oldAufgabe->setEndDate(new DateTimeImmutable('-3 weeks +2 hours'));
        $oldAufgabe->setCalendarEventType($aufgabeType);
        $this->em->persist($oldAufgabe);

        $oldAssignment = new TaskAssignment();
        $oldAssignment->setTask($task);
        $oldAssignment->setUser($rotationUser);
        $oldAssignment->setSubstituteUser($adminUser);
        $oldAssignment->setAssignedDate(new DateTimeImmutable('-3 weeks'));
        $oldAssignment->setStatus('offen');
        $oldAssignment->setCalendarEvent($oldAufgabe);
        $this->em->persist($oldAssignment);
        $this->em->flush();

        $dispatcher = static::getContainer()->get('event_dispatcher');

        // User adds game 2 — rotation should cover 2 games total.
        $team = $this->em->getRepository(Team::class)->find($team->getId());
        $game2 = $this->createGame($this->em, $team, 'Game 2 Multi Dup', '+1 week');
        $dispatcher->dispatch(new GameCreatedEvent($game2));

        // User adds game 3 — rotation should cover 3 games total.
        $team = $this->em->getRepository(Team::class)->find($team->getId());
        $game3 = $this->createGame($this->em, $team, 'Game 3 Multi Dup', '+2 weeks');
        $dispatcher->dispatch(new GameCreatedEvent($game3));

        $this->em->clear();

        $task = $this->em->getRepository(Task::class)->findOneBy(['title' => 'Multi Dup Per-Match Task']);
        $assignments = $this->getAssignmentsForTemplate($task, $this->em);

        // Exactly 1 assignment per game = 3 total.
        // Bug produces: old game × 3, game2 × 2, game3 × 1 = 6 total ("Pro Spiel 3 Tasks").
        $this->assertCount(
            3,
            $assignments,
            'After adding 2 new games there must be exactly 3 assignments (1 per game). '
            . 'Got ' . count($assignments) . '. '
            . 'The bug causes past game assignments to accumulate with every new game added.'
        );

        // Verify no game appears more than once.
        $assignedDateMap = array_count_values(
            array_map(static fn (TaskAssignment $a) => $a->getAssignedDate()->format('Y-m-d'), $assignments)
        );
        foreach ($assignedDateMap as $date => $count) {
            $this->assertSame(1, $count, "Game on {$date} has {$count} assignments — expected exactly 1");
        }
    }

    private function createUserWithPlayer(EntityManagerInterface $entityManager, string $email, string $firstName, string $lastName, Team $team): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setPassword('$2y$13$dummy');
        $user->setFirstName($firstName);
        $user->setLastName($lastName);
        $user->setIsVerified(true);
        $user->setIsEnabled(true);
        $entityManager->persist($user);

        $position = $entityManager->getRepository(\App\Entity\Position::class)->findOneBy([]);
        if (!$position) {
            throw new RuntimeException('No position found in database. Ensure fixtures are loaded.');
        }

        $player = new Player();
        $player->setFirstName($firstName);
        $player->setLastName($lastName);
        $player->setEmail($email);
        $player->setMainPosition($position);
        $entityManager->persist($player);

        $playerAssignment = new PlayerTeamAssignment();
        $playerAssignment->setTeam($team);
        $player->addPlayerTeamAssignment($playerAssignment);
        $entityManager->persist($playerAssignment);

        $relationType = $entityManager->getRepository(RelationType::class)
            ->findOneBy(['identifier' => 'self_player']);

        if (!$relationType) {
            $relationType = new RelationType();
            $relationType->setIdentifier('self_player');
            $relationType->setCategory('player');
            $relationType->setName('Eigener Spieler');
            $entityManager->persist($relationType);
        }

        $userRelation = new UserRelation();
        $userRelation->setUser($user);
        $userRelation->setPlayer($player);
        $userRelation->setRelationType($relationType);
        $entityManager->persist($userRelation);

        return $user;
    }

    private function createGame(EntityManagerInterface $entityManager, Team $homeTeam, string $title, string $dateModifier): Game
    {
        $spielEventType = $entityManager->getRepository(CalendarEventType::class)
            ->findOneBy(['name' => 'Spiel']);

        if (!$spielEventType) {
            throw new RuntimeException('Spiel CalendarEventType not found. Ensure fixtures are loaded.');
        }

        $gameType = $entityManager->getRepository(GameType::class)->findOneBy([])
            ?? $this->createGameType($entityManager);

        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTitle($title);
        $calendarEvent->setStartDate(new DateTimeImmutable($dateModifier));
        $calendarEvent->setEndDate(new DateTimeImmutable($dateModifier . ' +2 hours'));
        $calendarEvent->setCalendarEventType($spielEventType);
        $entityManager->persist($calendarEvent);

        $game = new Game();
        $game->setHomeTeam($homeTeam);
        $game->setAwayTeam($homeTeam);
        $game->setGameType($gameType);
        $game->setCalendarEvent($calendarEvent);
        $calendarEvent->setGame($game);
        $entityManager->persist($game);

        $entityManager->flush();  // Flush to make sure games are in database

        return $game;
    }

    private function createGameType(EntityManagerInterface $entityManager): GameType
    {
        $gameType = new GameType();
        $gameType->setName('Test Game Type');
        $entityManager->persist($gameType);

        return $gameType;
    }

    private function getOrCreateAgeGroup(EntityManagerInterface $entityManager): AgeGroup
    {
        $ageGroup = $entityManager->getRepository(AgeGroup::class)->findOneBy([]);
        if (!$ageGroup) {
            $ageGroup = new AgeGroup();
            $ageGroup->setCode('A_JUNIOREN_TEST');
            $ageGroup->setName('A-Junioren (Test)');
            $ageGroup->setEnglishName('U19');
            $ageGroup->setMinAge(17);
            $ageGroup->setMaxAge(18);
            $ageGroup->setReferenceDate('01-01');
            $entityManager->persist($ageGroup);
            $entityManager->flush();
        }

        return $ageGroup;
    }

    /**
     * @return array<TaskAssignment>
     */
    private function getAssignmentsForTemplate(Task $template, EntityManagerInterface $entityManager): array
    {
        // Neue Architektur: Assignments direkt für den Task holen
        $assignmentRepo = $entityManager->getRepository(TaskAssignment::class);

        return $assignmentRepo->findBy(['task' => $template]);
    }
}
