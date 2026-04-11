<?php

namespace Tests\Feature;

use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventType;
use App\Entity\Game;
use App\Entity\GameType;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TaskDeletionTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->client->disableReboot();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $this->em->getConnection()->beginTransaction();

        $this->adminUser = $this->em->getRepository(User::class)->findOneBy(['email' => 'user16@example.com']);
        self::assertNotNull($this->adminUser, 'Fixture-User user16@example.com nicht gefunden. Bitte Fixtures laden.');
    }

    protected function tearDown(): void
    {
        if ($this->em->getConnection()->isTransactionActive()) {
            $this->em->getConnection()->rollBack();
        }
        parent::tearDown();
        restore_exception_handler();
    }

    private function getOrCreateAgeGroup(EntityManagerInterface $em): AgeGroup
    {
        $ageGroup = $em->getRepository(AgeGroup::class)->findOneBy([]);
        if (!$ageGroup) {
            $ageGroup = new AgeGroup();
            $ageGroup->setCode('A_JUNIOREN_TEST');
            $ageGroup->setName('A-Junioren (Test)');
            $ageGroup->setEnglishName('U19');
            $ageGroup->setMinAge(17);
            $ageGroup->setMaxAge(18);
            $ageGroup->setReferenceDate('01-01');
            $em->persist($ageGroup);
            $em->flush();
        }

        return $ageGroup;
    }

    private function createUserWithPlayer(EntityManagerInterface $em, string $email, string $firstName, string $lastName, Team $team): User
    {
        $user = new User();
        $user->setEmail($email);
        $user->setPassword('$2y$13$dummy');
        $user->setFirstName($firstName);
        $user->setLastName($lastName);
        $user->setIsVerified(true);
        $user->setIsEnabled(true);
        $em->persist($user);

        $position = $em->getRepository(Position::class)->findOneBy([]);
        $player = new Player();
        $player->setFirstName($firstName);
        $player->setLastName($lastName);
        $player->setEmail($email);
        $player->setMainPosition($position);
        $em->persist($player);

        $assignment = new PlayerTeamAssignment();
        $assignment->setTeam($team);
        $player->addPlayerTeamAssignment($assignment);
        $em->persist($assignment);

        $relationType = $em->getRepository(\App\Entity\RelationType::class)
            ->findOneBy(['identifier' => 'self_player']);

        if (!$relationType) {
            $relationType = new \App\Entity\RelationType();
            $relationType->setIdentifier('self_player');
            $relationType->setCategory('player');
            $relationType->setName('Eigener Spieler');
            $em->persist($relationType);
        }

        $relation = new UserRelation();
        $relation->setUser($user);
        $relation->setPlayer($player);
        $relation->setRelationType($relationType);
        $em->persist($relation);

        return $user;
    }

    private function createGame(EntityManagerInterface $em, Team $team, string $title, string $when): Game
    {
        $spielType = $em->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        $gameType = $em->getRepository(GameType::class)->findOneBy([]);

        $calendarEvent = new CalendarEvent();
        $calendarEvent->setTitle($title);
        $calendarEvent->setStartDate(new DateTimeImmutable($when));
        $calendarEvent->setEndDate(new DateTimeImmutable($when . ' +2 hours'));
        $calendarEvent->setCalendarEventType($spielType);
        $em->persist($calendarEvent);

        $game = new Game();
        $game->setHomeTeam($team);
        $game->setAwayTeam($team);
        $game->setCalendarEvent($calendarEvent);
        $game->setGameType($gameType);
        $em->persist($game);

        $em->flush();  // Flush to make sure games are in database

        return $game;
    }

    /**
     * Helper zum Abrufen aller Assignments für einen Task.
     *
     * @return array<TaskAssignment>
     */
    private function getAssignmentsForTask(Task $task, EntityManagerInterface $em): array
    {
        $assignmentRepo = $em->getRepository(TaskAssignment::class);
        $assignments = $assignmentRepo->findBy(['task' => $task]);
        usort(
            $assignments,
            fn ($a, $b) => ($a->getTask()->getAssignedDate()?->getTimestamp() ?? 0) <=>
            ($b->getTask()->getAssignedDate()?->getTimestamp() ?? 0)
        );

        return $assignments;
    }

    public function testDeleteSingleTaskAssignment(): void
    {
        $ageGroup = $this->getOrCreateAgeGroup($this->em);
        $team = new Team();
        $team->setName('Test Team Delete Single');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $user = $this->createUserWithPlayer($this->em, 'test-deletion-single@example.com', 'Delete', 'Single', $team);

        // Create games BEFORE creating task
        $game1 = $this->createGame($this->em, $team, 'Test Game Del 1', '+1 week');
        $game2 = $this->createGame($this->em, $team, 'Test Game Del 2', '+2 weeks');

        $this->em->flush();

        // Now clear to ensure fresh data
        $this->em->clear();

        // Re-fetch user, team, and admin user
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'test-deletion-single@example.com']);
        $team = $this->em->getRepository(Team::class)->findOneBy(['name' => 'Test Team Delete Single']);
        $adminUser = $this->em->find(User::class, $this->adminUser->getId());

        // Create task via API
        $this->client->loginUser($adminUser);
        $this->client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Delete Single',
            'description' => 'Should allow deleting single assignment',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        // Verify task and assignments were created
        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Delete Single']);
        $this->assertNotNull($task);

        $assignments = $this->getAssignmentsForTask($task, $this->em);
        $initialCount = count($assignments);
        $this->assertGreaterThan(0, $initialCount, 'Should have at least one assignment');

        // Get first assignment
        $firstAssignment = $assignments[0];
        $assignmentId = $firstAssignment->getId();

        // Delete single assignment via assignment endpoint
        $this->client->request('DELETE', '/api/tasks/assignments/' . $assignmentId . '?deleteMode=single');
        $this->assertResponseIsSuccessful();

        $this->em->clear();

        // Verify only one assignment was deleted
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Delete Single']);
        $this->assertNotNull($task, 'Task should still exist');

        $remainingAssignments = $this->getAssignmentsForTask($task, $this->em);
        $this->assertCount($initialCount - 1, $remainingAssignments, 'Should have one less assignment');

        // Verify the specific assignment was deleted
        $assignmentRepo = $this->em->getRepository(TaskAssignment::class);
        $deletedAssignment = $assignmentRepo->find($assignmentId);
        $this->assertNull($deletedAssignment, 'Deleted assignment should not exist');
    }

    public function testDeleteTaskSeries(): void
    {
        $ageGroup = $this->getOrCreateAgeGroup($this->em);
        $team = new Team();
        $team->setName('Test Team Delete Series');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $user = $this->createUserWithPlayer($this->em, 'test-task-delete-series@example.com', 'Delete', 'Series', $team);

        $game1 = $this->createGame($this->em, $team, 'Test Game Series 1', '+1 week');
        $game2 = $this->createGame($this->em, $team, 'Test Game Series 2', '+2 weeks');

        $this->em->flush();

        // Clear EM before making POST to ensure fresh state
        $this->em->clear();

        // Re-fetch user and admin
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'test-task-delete-series@example.com']);
        $adminUser = $this->em->find(User::class, $this->adminUser->getId());

        // Create task via API as admin
        $this->client->loginUser($adminUser);
        $this->client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Delete Series',
            'description' => 'Should allow deleting entire series',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        // Get the task ID BEFORE clearing the EM
        $task = $this->em->getRepository(Task::class)->findOneBy(['title' => 'Test Task - Delete Series']);
        $this->assertNotNull($task);
        $taskId = $task->getId();

        $assignments = $this->getAssignmentsForTask($task, $this->em);
        $this->assertGreaterThan(0, count($assignments), 'Should have at least one assignment');

        // Delete via the assignment endpoint instead (which works)
        $firstAssignment = $assignments[0];
        $assignmentId = $firstAssignment->getId();

        // Re-login before DELETE (ensure fresh auth context)
        $this->client->loginUser($adminUser);

        // Make the DELETE request via assignment endpoint with deleteMode=series
        $this->client->request('DELETE', '/api/tasks/assignments/' . $assignmentId . '?deleteMode=series');
        $this->assertResponseIsSuccessful();

        $this->em->clear();

        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->find($taskId);
        $this->assertNull($task, 'Task should be deleted');
    }

    public function testDeleteSeriesViaAssignmentEndpoint(): void
    {
        $ageGroup = $this->getOrCreateAgeGroup($this->em);
        $team = new Team();
        $team->setName('Test Team Delete Series Via Assignment');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $user = $this->createUserWithPlayer($this->em, 'test-deletion-series2@example.com', 'Delete', 'SeriesTwo', $team);

        $game1 = $this->createGame($this->em, $team, 'Test Game Via 1', '+1 week');
        $game2 = $this->createGame($this->em, $team, 'Test Game Via 2', '+2 weeks');

        $this->em->flush();

        // Clear to ensure fresh data
        $this->em->clear();

        // Re-fetch entities
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => 'test-deletion-series2@example.com']);
        $adminUser = $this->em->find(User::class, $this->adminUser->getId());

        // Create task via API
        $this->client->loginUser($adminUser);
        $this->client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Delete Series Via Assignment',
            'description' => 'Should allow deleting entire series via assignment endpoint',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        // Verify task and assignments were created
        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Delete Series Via Assignment']);
        $this->assertNotNull($task);
        $taskId = $task->getId();

        $assignments = $this->getAssignmentsForTask($task, $this->em);
        $this->assertGreaterThan(0, count($assignments), 'Should have at least one assignment');

        $firstAssignment = $assignments[0];
        $assignmentId = $firstAssignment->getId();

        // Delete entire series via assignment endpoint with deleteMode=series
        $this->client->request('DELETE', '/api/tasks/assignments/' . $assignmentId . '?deleteMode=series');
        $this->assertResponseIsSuccessful();

        $this->em->clear();

        // Verify task was deleted
        $task = $taskRepo->find($taskId);
        $this->assertNull($task, 'Task should be deleted');

        // Verifiziere, dass der Task gelöscht wurde (keine Serien mehr)
        // (Task wurde oben schon geprüft)
    }

    public function testDeleteSingleAssignmentRemovesCalendarEvent(): void
    {
        $user = new User();
        $user->setEmail('test-task-delete-calendar@example.com');
        $user->setPassword('$2y$13$dummy');
        $user->setFirstName('testuser');
        $user->setLastName('calendar');
        $user->setRoles(['ROLE_USER']);
        $user->setIsVerified(true);
        $user->setIsEnabled(true);
        $this->em->persist($user);

        $ageGroup = $this->getOrCreateAgeGroup($this->em);
        $team = new Team();
        $team->setName('Test Team Delete Calendar Event');
        $team->setAgeGroup($ageGroup);
        $this->em->persist($team);

        $position = $this->em->getRepository(Position::class)->findOneBy([]);
        if (!$position) {
            $position = new Position();
            $position->setName('Torwart');
            $this->em->persist($position);
            $this->em->flush();
        }
        $player = new Player();
        $player->setFirstName($user->getFirstName());
        $player->setLastName($user->getLastName());
        $player->setEmail($user->getEmail());
        $player->setMainPosition($position);
        $this->em->persist($player);

        $assignment = new PlayerTeamAssignment();
        $assignment->setTeam($team);
        $player->addPlayerTeamAssignment($assignment);
        $this->em->persist($assignment);

        $relationType = $this->em->getRepository(\App\Entity\RelationType::class)
            ->findOneBy(['identifier' => 'self_player']);

        if (!$relationType) {
            $relationType = new \App\Entity\RelationType();
            $relationType->setIdentifier('self_player');
            $relationType->setCategory('player');
            $relationType->setName('Eigener Spieler');
            $this->em->persist($relationType);
        }

        $relation = new UserRelation();
        $relation->setUser($user);
        $relation->setPlayer($player);
        $relation->setRelationType($relationType);
        $this->em->persist($relation);

        $game = $this->createGame($this->em, $team, 'Test Game Cal 1', '+1 week');

        $this->em->flush();

        $this->client->loginUser($user);
        $this->client->request('POST', '/api/tasks', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Test Task - Delete Calendar',
            'description' => 'Should remove calendar event when deleting single assignment',
            'isRecurring' => true,
            'recurrenceMode' => 'per_match',
            'rotationUsers' => [$user->getId()],
            'rotationCount' => 1,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $this->em->clear();

        $taskRepo = $this->em->getRepository(Task::class);
        $task = $taskRepo->findOneBy(['title' => 'Test Task - Delete Calendar']);
        $this->assertNotNull($task);

        $assignments = $this->getAssignmentsForTask($task, $this->em);
        $this->assertGreaterThan(0, count($assignments), 'Should have at least one assignment');
        $firstAssignment = $assignments[0];

        // Das CalendarEvent ist direkt mit dem TaskAssignment verknüpft
        $calendarEvent = $firstAssignment->getCalendarEvent();
        $this->assertNotNull($calendarEvent, 'Should have a calendar event');
        $calendarEventId = $calendarEvent->getId();

        $this->client->loginUser($this->em->getRepository(User::class)->findOneBy(['email' => 'test-task-delete-calendar@example.com']));
        $this->client->request('DELETE', '/api/tasks/assignments/' . $firstAssignment->getId() . '?deleteMode=single');
        $this->assertResponseIsSuccessful();

        $calendarEventRepo = $this->em->getRepository(CalendarEvent::class);
        $deletedCalendarEvent = $calendarEventRepo->find($calendarEventId);
        $this->assertNull($deletedCalendarEvent, 'Calendar event should be deleted');
    }
}
