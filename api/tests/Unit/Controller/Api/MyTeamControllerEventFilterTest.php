<?php

namespace App\Tests\Unit\Controller\Api;

use App\Controller\Api\MyTeamController;
use App\Entity\AgeGroup;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\Game;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\Position;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\Tournament;
use App\Entity\TournamentTeam;
use App\Entity\User;
use App\Entity\UserRelation;
use App\Repository\CalendarEventRepository;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * Tests die Event-Filterlogik in MyTeamController::overview():
 * - Training-Events werden über CalendarEventPermissions gefunden
 * - Spiele werden über Game::homeTeam / Game::awayTeam gefunden
 * - Turniere werden über Tournament::getTeams() (TournamentTeam) gefunden
 * - Nicht-relevante Events werden herausgefiltert
 */
#[AllowMockObjectsWithoutExpectations]
class MyTeamControllerEventFilterTest extends TestCase
{
    private const MY_TEAM_ID = 1;
    private const OTHER_TEAM_ID = 99;

    /** @var EntityManagerInterface&MockObject */
    private EntityManagerInterface $em;

    /** @var User&MockObject */
    private User $user;

    /** @var Team&MockObject */
    private Team $myTeam;

    /** @var Team&MockObject */
    private Team $otherTeam;

    private MyTeamController $controller;

    protected function setUp(): void
    {
        $this->myTeam = $this->makeTeam(self::MY_TEAM_ID, 'Mein Team');
        $this->otherTeam = $this->makeTeam(self::OTHER_TEAM_ID, 'Anderes Team');

        // Benutzer mit einer Spieler-Relation zum myTeam
        $this->user = $this->createMock(User::class);
        $this->user->method('getUserRelations')
            ->willReturn(new ArrayCollection([$this->makePlayerRelation($this->myTeam)]));

        // EntityManager gibt leere Task- und UserRelation-Repositories zurück
        $emptyRepo = $this->createMock(\Doctrine\ORM\EntityRepository::class);
        $emptyRepo->method('findBy')->willReturn([]);

        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->em->method('getRepository')->willReturn($emptyRepo);

        // Controller mit minimalem Container aufsetzen
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($this->user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new ContainerBuilder();
        $container->set('security.token_storage', $tokenStorage);
        $container->set('security.authorization_checker', $this->createMock(AuthorizationCheckerInterface::class));

        $this->controller = new MyTeamController($this->em);
        $this->controller->setContainer($container);
    }

    // ─── Training-Events über CalendarEventPermissions ───────────────────────

    public function testTrainingEventViaPermissionIsIncluded(): void
    {
        $permission = $this->createMock(CalendarEventPermission::class);
        $permission->method('getTeam')->willReturn($this->myTeam);

        $event = $this->makeCalendarEvent(1, 'Training', [
            'permissions' => [$permission],
        ]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult(['Training'], $result);
    }

    public function testTrainingEventForOtherTeamIsExcluded(): void
    {
        $permission = $this->createMock(CalendarEventPermission::class);
        $permission->method('getTeam')->willReturn($this->otherTeam);

        $event = $this->makeCalendarEvent(1, 'Fremdes Training', [
            'permissions' => [$permission],
        ]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult([], $result);
    }

    // ─── Spiel-Events über Game::homeTeam / Game::awayTeam ───────────────────

    public function testGameEventViaHomeTeamIsIncluded(): void
    {
        $game = $this->makeGame($this->myTeam, $this->otherTeam);
        $event = $this->makeCalendarEvent(2, 'Heimspiel', ['game' => $game]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult(['Heimspiel'], $result);
    }

    public function testGameEventViaAwayTeamIsIncluded(): void
    {
        $game = $this->makeGame($this->otherTeam, $this->myTeam);
        $event = $this->makeCalendarEvent(3, 'Auswärtsspiel', ['game' => $game]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult(['Auswärtsspiel'], $result);
    }

    public function testGameEventWithNonMatchingTeamsIsExcluded(): void
    {
        $thirdTeam = $this->makeTeam(42, 'Drittes Team');
        $game = $this->makeGame($this->otherTeam, $thirdTeam);
        $event = $this->makeCalendarEvent(4, 'Fremdes Spiel', ['game' => $game]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult([], $result);
    }

    // ─── Turnier-Events über TournamentTeam ──────────────────────────────────

    public function testTournamentEventViaMatchingTeamIsIncluded(): void
    {
        $tournamentTeam = $this->createMock(TournamentTeam::class);
        $tournamentTeam->method('getTeam')->willReturn($this->myTeam);

        $tournament = $this->createMock(Tournament::class);
        $tournament->method('getTeams')->willReturn(new ArrayCollection([$tournamentTeam]));

        $event = $this->makeCalendarEvent(5, 'Turnier', ['tournament' => $tournament]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult(['Turnier'], $result);
    }

    public function testTournamentEventWithNonMatchingTeamIsExcluded(): void
    {
        $tournamentTeam = $this->createMock(TournamentTeam::class);
        $tournamentTeam->method('getTeam')->willReturn($this->otherTeam);

        $tournament = $this->createMock(Tournament::class);
        $tournament->method('getTeams')->willReturn(new ArrayCollection([$tournamentTeam]));

        $event = $this->makeCalendarEvent(6, 'Fremdes Turnier', ['tournament' => $tournament]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult([], $result);
    }

    public function testTournamentEventWithEmptyTeamListIsExcluded(): void
    {
        $tournament = $this->createMock(Tournament::class);
        $tournament->method('getTeams')->willReturn(new ArrayCollection());

        $event = $this->makeCalendarEvent(7, 'Leeres Turnier', ['tournament' => $tournament]);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult([], $result);
    }

    // ─── Event ohne jede Verbindung ──────────────────────────────────────────

    public function testEventWithNoLinksIsExcluded(): void
    {
        $event = $this->makeCalendarEvent(8, 'Unbekanntes Event', []);

        $result = $this->callOverview([$event]);

        $this->assertEventTitlesInResult([], $result);
    }

    // ─── Kombinierter Test: mehrere Events gemischt ──────────────────────────

    public function testMixedEventsOnlyMyTeamEventsAreReturned(): void
    {
        // Soll drin sein: Training (Permission)
        $perm = $this->createMock(CalendarEventPermission::class);
        $perm->method('getTeam')->willReturn($this->myTeam);
        $training = $this->makeCalendarEvent(1, 'Training', ['permissions' => [$perm]]);

        // Soll drin sein: Heimspiel (Game)
        $heimspiel = $this->makeCalendarEvent(
            2,
            'Heimspiel',
            ['game' => $this->makeGame($this->myTeam, $this->otherTeam)]
        );

        // Soll NICHT drin sein: Fremdes Spiel
        $fremdesSpiel = $this->makeCalendarEvent(
            3,
            'Fremdes Spiel',
            ['game' => $this->makeGame($this->otherTeam, $this->makeTeam(42, 'Klub X'))]
        );

        // Soll drin sein: Turnier
        $tt = $this->createMock(TournamentTeam::class);
        $tt->method('getTeam')->willReturn($this->myTeam);
        $tourn = $this->createMock(Tournament::class);
        $tourn->method('getTeams')->willReturn(new ArrayCollection([$tt]));
        $turnier = $this->makeCalendarEvent(4, 'Turnier', ['tournament' => $tourn]);

        $result = $this->callOverview([$training, $heimspiel, $fremdesSpiel, $turnier]);

        $this->assertEventTitlesInResult(['Training', 'Heimspiel', 'Turnier'], $result);
        $this->assertNotContains('Fremdes Spiel', array_column($result['upcomingEvents'], 'title'));
    }

    // ─── Hilfsmethoden ───────────────────────────────────────────────────────

    /**
     * @param CalendarEvent[] $events
     *
     * @return array<string, mixed>
     */
    private function callOverview(array $events): array
    {
        $calendarEventRepo = $this->createMock(CalendarEventRepository::class);
        $calendarEventRepo->method('findBetweenDates')->willReturn($events);

        $response = $this->controller->overview($calendarEventRepo);
        $data = json_decode($response->getContent(), true);

        $this->assertIsArray($data);

        return $data;
    }

    /**
     * @param string[]             $expectedTitles
     * @param array<string, mixed> $result
     */
    private function assertEventTitlesInResult(array $expectedTitles, array $result): void
    {
        $actualTitles = array_column($result['upcomingEvents'] ?? [], 'title');
        sort($expectedTitles);
        sort($actualTitles);
        $this->assertSame(
            $expectedTitles,
            $actualTitles,
            sprintf(
                'Erwartete Events [%s], erhalten [%s]',
                implode(', ', $expectedTitles),
                implode(', ', $actualTitles)
            )
        );
    }

    /**
     * Event-Mock mit konfigurierbaren Eigenschaften.
     *
     * $options:
     *   'permissions' => CalendarEventPermission[]  (default: [])
     *   'game'        => Game|null                 (default: null)
     *   'tournament'  => Tournament|null           (default: null)
     *
     * @param array<string, mixed> $options
     */
    private function makeCalendarEvent(int $id, string $title, array $options): CalendarEvent&MockObject
    {
        $permissions = $options['permissions'] ?? [];
        $game = $options['game'] ?? null;
        $tournament = $options['tournament'] ?? null;

        $event = $this->createMock(CalendarEvent::class);
        $event->method('getId')->willReturn($id);
        $event->method('getTitle')->willReturn($title);
        $event->method('getStartDate')->willReturn(new DateTime('+1 day'));
        $event->method('getEndDate')->willReturn(null);
        $event->method('getLocation')->willReturn(null);
        $event->method('getCalendarEventType')->willReturn(null);
        $event->method('getPermissions')->willReturn(new ArrayCollection($permissions));
        $event->method('getGame')->willReturn($game);
        $event->method('getTournament')->willReturn($tournament);

        return $event;
    }

    private function makeGame(Team $homeTeam, Team $awayTeam): Game&MockObject
    {
        $game = $this->createMock(Game::class);
        $game->method('getHomeTeam')->willReturn($homeTeam);
        $game->method('getAwayTeam')->willReturn($awayTeam);

        return $game;
    }

    private function makeTeam(int $id, string $name): Team&MockObject
    {
        $ageGroup = $this->createMock(AgeGroup::class);
        $ageGroup->method('getId')->willReturn($id * 10);
        $ageGroup->method('getName')->willReturn('U' . $id);

        $team = $this->createMock(Team::class);
        $team->method('getId')->willReturn($id);
        $team->method('getName')->willReturn($name);
        $team->method('getAgeGroup')->willReturn($ageGroup);
        $team->method('getLeague')->willReturn(null);
        $team->method('getCurrentPlayers')->willReturn([]);
        $team->method('getCoachTeamAssignments')->willReturn(new ArrayCollection());

        return $team;
    }

    private function makePlayerRelation(Team $team): UserRelation&MockObject
    {
        $relationType = $this->createMock(RelationType::class);
        $relationType->method('getIdentifier')->willReturn('self_player');
        $relationType->method('getName')->willReturn('Ich');
        $relationType->method('getCategory')->willReturn('player');

        $pta = $this->createMock(PlayerTeamAssignment::class);
        $pta->method('getTeam')->willReturn($team);
        $pta->method('getShirtNumber')->willReturn(7);

        $player = $this->createMock(Player::class);
        $player->method('getId')->willReturn(1);
        $player->method('getFirstName')->willReturn('Max');
        $player->method('getLastName')->willReturn('Mustermann');
        $player->method('getFullName')->willReturn('Max Mustermann');
        $position = $this->createMock(Position::class);
        $position->method('getId')->willReturn(1);
        $position->method('getName')->willReturn('Mittelfeld');
        $player->method('getMainPosition')->willReturn($position);
        $player->method('getPlayerTeamAssignments')->willReturn(new ArrayCollection([$pta]));

        $relation = $this->createMock(UserRelation::class);
        $relation->method('getRelationType')->willReturn($relationType);
        $relation->method('getPlayer')->willReturn($player);
        $relation->method('getCoach')->willReturn(null);

        return $relation;
    }
}
