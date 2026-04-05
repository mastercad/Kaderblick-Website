<?php

namespace App\Service;

use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\CalendarEventType;
use App\Entity\Club;
use App\Entity\Cup;
use App\Entity\Game;
use App\Entity\GameEvent;
use App\Entity\GameEventType;
use App\Entity\GameType;
use App\Entity\League;
use App\Entity\Location;
use App\Entity\Participation;
use App\Entity\Substitution;
use App\Entity\Task;
use App\Entity\TaskAssignment;
use App\Entity\Team;
use App\Entity\TeamRide;
use App\Entity\Tournament;
use App\Entity\TournamentMatch;
use App\Entity\User;
use App\Entity\Video;
use App\Enum\CalendarEventPermissionType;
use App\Event\GameCreatedEvent;
use App\Event\GameDeletedEvent;
use DateTime;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class CalendarEventService
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ValidatorInterface $validator,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly TaskEventGeneratorService $taskEventGeneratorService,
        private readonly Security $security,
        private readonly TeamMembershipService $teamMembershipService,
    ) {
    }

    public function deleteCalendarEventsForTask(Task $task): void
    {
        $taskAssignments = $this->entityManager->getRepository(TaskAssignment::class)
            ->findBy(['task' => $task]);

        foreach ($taskAssignments as $taskAssignment) {
            $calendarEvent = $taskAssignment->getCalendarEvent();
            if ($calendarEvent) {
                $this->deleteCalendarEventWithDependencies($calendarEvent);
            }
        }
    }

    /**
     * Löscht ein CalendarEvent und alle seine Abhängigkeiten.
     */
    public function deleteCalendarEventWithDependencies(CalendarEvent $calendarEvent): void
    {
        // Wenn Turnier-Event: Tournament, Matches und zugehörige Games löschen
        if ('Turnier' === $calendarEvent->getCalendarEventType()?->getName()) {
            $tournament = $this->entityManager->getRepository(Tournament::class)->findOneBy(['calendarEvent' => $calendarEvent]);
            if ($tournament) {
                // Lösche Abhängigkeiten der Match-Games (game_events, substitutions, videos),
                // dann die Matches, das Tournament und zuletzt die Games selbst.
                $gameEventRepo = $this->entityManager->getRepository(GameEvent::class);
                $substitutionRepo = $this->entityManager->getRepository(Substitution::class);
                $videoRepo = $this->entityManager->getRepository(Video::class);
                $matchGames = [];

                foreach ($tournament->getMatches() as $match) {
                    $matchGame = $match->getGame();
                    if ($matchGame) {
                        $matchGames[] = $matchGame;
                        foreach ($gameEventRepo->findBy(['game' => $matchGame]) as $ge) {
                            $this->entityManager->remove($ge);
                        }
                        foreach ($substitutionRepo->findBy(['game' => $matchGame]) as $sub) {
                            $this->entityManager->remove($sub);
                        }
                        foreach ($videoRepo->findBy(['game' => $matchGame]) as $video) {
                            $this->entityManager->remove($video);
                        }
                    }
                    $this->entityManager->remove($match);
                }
                $this->entityManager->remove($tournament);
                // Match-Games nach Matches/Tournament entfernen, damit keine FK-Verletzung auftritt
                foreach ($matchGames as $matchGame) {
                    $this->entityManager->remove($matchGame);
                }
            }
        }

        $game = $calendarEvent->getGame();

        $connection = $this->entityManager->getConnection();
        $connection->executeStatement(
            'DELETE FROM notifications WHERE JSON_EXTRACT(data, "$.eventId") = :eventId',
            ['eventId' => $calendarEvent->getId()]
        );

        $teamRideRepo = $this->entityManager->getRepository(TeamRide::class);
        $teamRides = $teamRideRepo->findBy(['event' => $calendarEvent]);
        foreach ($teamRides as $teamRide) {
            $this->entityManager->remove($teamRide);
        }

        $participationRepo = $this->entityManager->getRepository(Participation::class);
        $participations = $participationRepo->findBy(['event' => $calendarEvent]);
        foreach ($participations as $participation) {
            $this->entityManager->remove($participation);
        }

        if ($game) {
            $gameEventRepo = $this->entityManager->getRepository(GameEvent::class);
            $gameEvents = $gameEventRepo->findBy(['game' => $game]);
            foreach ($gameEvents as $gameEvent) {
                $this->entityManager->remove($gameEvent);
            }

            $substitutionRepo = $this->entityManager->getRepository(Substitution::class);
            $substitutions = $substitutionRepo->findBy(['game' => $game]);
            foreach ($substitutions as $substitution) {
                $this->entityManager->remove($substitution);
            }

            $videoRepo = $this->entityManager->getRepository(Video::class);
            $videos = $videoRepo->findBy(['game' => $game]);
            foreach ($videos as $video) {
                $this->entityManager->remove($video);
            }

            $this->entityManager->remove($game);
        }

        $taskAssignmentRepo = $this->entityManager->getRepository(TaskAssignment::class);
        $taskAssignments = $taskAssignmentRepo->findBy(['calendarEvent' => $calendarEvent]);
        foreach ($taskAssignments as $taskAssignment) {
            $this->entityManager->remove($taskAssignment);
        }

        $this->entityManager->remove($calendarEvent);
        $this->entityManager->flush();

        if ($game) {
            $this->eventDispatcher->dispatch(new GameDeletedEvent($game));
        }
    }

    /**
     * @param array<mixed> $data
     *
     * @return ConstraintViolationList<int, mixed>
     */
    /**
     * Validates that the authenticated user's own team is part of the game or tournament
     * they are trying to create or edit.
     *
     * Returns null when valid (or when the user is admin/superadmin).
     * Returns a human-readable German error message when the check fails.
     *
     * @param array<string, mixed> $data
     */
    public function validateMatchTeamOwnership(array $data, User $user): ?string
    {
        // Admins and superadmins may always create events for any team
        if (
            in_array('ROLE_SUPERADMIN', $user->getRoles(), true)
            || in_array('ROLE_ADMIN', $user->getRoles(), true)
        ) {
            return null;
        }

        $calendarEventTypeSpiel = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        $calendarEventTypeTournament = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Turnier']);

        $eventTypeId = (int) ($data['eventTypeId'] ?? 0);
        $isGameEvent = $calendarEventTypeSpiel && $eventTypeId === $calendarEventTypeSpiel->getId();
        $isTournamentEvent = $calendarEventTypeTournament && $eventTypeId === $calendarEventTypeTournament->getId();
        $isTournamentPayload = isset($data['pendingTournamentMatches'])
            && is_array($data['pendingTournamentMatches'])
            && count($data['pendingTournamentMatches']) > 0;

        // Only game and tournament events require team-ownership validation
        if (!$isGameEvent && !$isTournamentEvent) {
            return null;
        }

        // Collect IDs of all teams the user is currently coaching
        $coachTeamIds = [];
        foreach ($user->getUserRelations() as $relation) {
            if ($relation->getCoach()) {
                foreach ($relation->getCoach()->getCoachTeamAssignments() as $assignment) {
                    $coachTeamIds[] = (int) $assignment->getTeam()->getId();
                }
            }
        }

        if (empty($coachTeamIds)) {
            return 'Du bist keinem Team als Trainer zugeordnet. '
                . 'Spiele und Turniere können nur von Trainern ihres eigenen Teams angelegt werden.';
        }

        // ── Regular game (no tournament payload) ──────────────────────────────
        if ($isGameEvent && !$isTournamentPayload) {
            $homeTeamId = (int) ($data['game']['homeTeamId'] ?? 0);
            $awayTeamId = (int) ($data['game']['awayTeamId'] ?? 0);

            // If teams are not yet set, let the normal validation handle it
            if (!$homeTeamId || !$awayTeamId) {
                return null;
            }

            if (
                !in_array($homeTeamId, $coachTeamIds, true)
                && !in_array($awayTeamId, $coachTeamIds, true)
            ) {
                return 'Dein Team muss als Heim- oder Auswärtsteam eingetragen sein. '
                    . 'Du kannst nur Spiele anlegen, an denen eines deiner Teams beteiligt ist.';
            }

            return null;
        }

        // ── Tournament event ──────────────────────────────────────────────────
        if (!$isTournamentPayload) {
            // No matches defined yet — the user is a coach, allow creation
            return null;
        }

        foreach ($data['pendingTournamentMatches'] as $match) {
            $homeTeamId = (int) ($match['homeTeamId'] ?? 0);
            $awayTeamId = (int) ($match['awayTeamId'] ?? 0);
            if (
                in_array($homeTeamId, $coachTeamIds, true)
                || in_array($awayTeamId, $coachTeamIds, true)
            ) {
                return null; // Own team found — permission granted
            }
        }

        return 'Dein Team muss in mindestens einem Turnierspiel als Heim- oder Auswärtsteam vertreten sein. '
            . 'Du kannst nur Turniere anlegen, an denen eines deiner Teams teilnimmt.';
    }

    /**
     * @param array<string, mixed> $data
     */
    public function updateEventFromData(CalendarEvent $calendarEvent, array $data): ConstraintViolationList
    {
        $calendarEventTypeSpiel = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Spiel']);
        $calendarEventTypeTournament = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Turnier']);
        $gameEventTypeTournament = $this->entityManager->getRepository(GameEventType::class)->findOneBy(['name' => 'Turnier']);
        $calendarEvent->setTitle($data['title'] ?? $calendarEvent->getTitle());
        $calendarEvent->setDescription($data['description'] ?? null);
        $calendarEvent->setStartDate(new DateTime($data['startDate']));

        /** @var User $currentUser */
        $currentUser = $this->security->getUser();

        if (!$calendarEvent->getId()) {
            $calendarEvent->setCreatedBy($currentUser);
        }

        if (!empty($data['eventTypeId'])) {
            $type = $this->entityManager->getReference(CalendarEventType::class, $data['eventTypeId']);
            $calendarEvent->setCalendarEventType($type);
        }

        if (isset($data['endDate'])) {
            $calendarEvent->setEndDate(new DateTime($data['endDate']));
        }

        if (isset($data['locationId']) && $data['locationId']) {
            $location = $this->entityManager->getReference(Location::class, (int) $data['locationId']);
            $calendarEvent->setLocation($location);
        }
        $gameCreated = false;
        $eventTypeId = $data['eventTypeId'] ?? null;
        $isGameEvent = $eventTypeId && $calendarEventTypeSpiel && (int) $eventTypeId === $calendarEventTypeSpiel->getId();
        $isTournamentPayload = isset($data['pendingTournamentMatches']) && is_array($data['pendingTournamentMatches']) && count($data['pendingTournamentMatches']) > 0;
        $isTournamentEvent = $eventTypeId && $calendarEventTypeTournament && (int) $eventTypeId === $calendarEventTypeTournament->getId();

        // Tournament verarbeiten, wenn EventType "Turnier" ODER "Spiel" mit Turnier-Payload
        if ($isTournamentEvent || ($isGameEvent && $isTournamentPayload)) {
            $this->processTournament($calendarEvent, $data);
        }

        // Nur ein Spiel anlegen, wenn es KEIN Turnier-Payload ist
        if ($isGameEvent && !$isTournamentPayload) {
            if (null === $calendarEvent->getGame()) {
                $game = new Game();
                $calendarEvent->setGame($game);
                $game->setCalendarEvent($calendarEvent);
                $this->entityManager->persist($game);
                $gameCreated = true;
            }

            if (isset($data['game']['homeTeamId']) && $data['game']['homeTeamId']) {
                $homeTeam = $this->entityManager->getReference(Team::class, (int) $data['game']['homeTeamId']);
                $calendarEvent->getGame()?->setHomeTeam($homeTeam);
            }

            if (isset($data['game']['awayTeamId']) && $data['game']['awayTeamId']) {
                $awayTeam = $this->entityManager->getReference(Team::class, (int) $data['game']['awayTeamId']);
                $calendarEvent->getGame()?->setAwayTeam($awayTeam);
            }

            if (isset($data['gameTypeId']) && $data['gameTypeId']) {
                $gameType = $this->entityManager->getReference(GameType::class, (int) $data['gameTypeId']);
                $calendarEvent->getGame()?->setGameType($gameType);
            }

            if (isset($data['fussballDeUrl']) && $data['fussballDeUrl']) {
                $calendarEvent->getGame()?->setFussballDeUrl($data['fussballDeUrl']);
            }

            if (isset($data['fussballDeId']) && $data['fussballDeId']) {
                $calendarEvent->getGame()?->setFussballDeId($data['fussballDeId']);
            }

            if (isset($data['leagueId']) && $data['leagueId']) {
                $league = $this->entityManager->getReference(League::class, (int) $data['leagueId']);
                $calendarEvent->getGame()?->setLeague($league);
            } elseif (array_key_exists('leagueId', $data) && !$data['leagueId']) {
                $calendarEvent->getGame()?->setLeague(null);
            }

            if (isset($data['cupId']) && $data['cupId']) {
                $cup = $this->entityManager->getReference(Cup::class, (int) $data['cupId']);
                $calendarEvent->getGame()?->setCup($cup);
            } elseif (array_key_exists('cupId', $data) && !$data['cupId']) {
                $calendarEvent->getGame()?->setCup(null);
            }

            // Game timing fields
            if (isset($data['game']['halfDuration'])) {
                $calendarEvent->getGame()?->setHalfDuration((int) $data['game']['halfDuration']);
            }
            if (isset($data['game']['halftimeBreakDuration'])) {
                $calendarEvent->getGame()?->setHalftimeBreakDuration((int) $data['game']['halftimeBreakDuration']);
            }
            if (array_key_exists('firstHalfExtraTime', $data['game'] ?? [])) {
                $val = $data['game']['firstHalfExtraTime'];
                $calendarEvent->getGame()?->setFirstHalfExtraTime(null !== $val && '' !== $val ? (int) $val : null);
            }
            if (array_key_exists('secondHalfExtraTime', $data['game'] ?? [])) {
                $val = $data['game']['secondHalfExtraTime'];
                $calendarEvent->getGame()?->setSecondHalfExtraTime(null !== $val && '' !== $val ? (int) $val : null);
            }
        }

        // Auto-calculate end date for Spiel events if not provided in payload
        if ($isGameEvent && !$isTournamentPayload && !isset($data['endDate']) && null !== $calendarEvent->getStartDate()) {
            $halfDur = $calendarEvent->getGame()?->getHalfDuration() ?? 45;
            $breakDur = $calendarEvent->getGame()?->getHalftimeBreakDuration() ?? 15;
            $totalMinutes = 2 * $halfDur + $breakDur;
            $endDt = DateTime::createFromInterface($calendarEvent->getStartDate());
            $endDt->modify("+{$totalMinutes} minutes");
            $calendarEvent->setEndDate($endDt);
        }

        // Training series metadata: update when explicitly provided in payload
        if (array_key_exists('trainingWeekdays', $data)) {
            $calendarEvent->setTrainingWeekdays($data['trainingWeekdays']);
        }
        if (array_key_exists('trainingSeriesEndDate', $data)) {
            $calendarEvent->setTrainingSeriesEndDate($data['trainingSeriesEndDate']);
        }
        if (array_key_exists('trainingSeriesId', $data)) {
            $calendarEvent->setTrainingSeriesId($data['trainingSeriesId']);
        }

        if (isset($data['task']) && is_array($data['task'])) {
            $taskData = $data['task'];

            $task = null;
            $taskAssignment = $this->entityManager->getRepository(TaskAssignment::class)
                ->findOneBy(['calendarEvent' => $calendarEvent]);

            if ($taskAssignment && $taskAssignment->getTask()) {
                $task = $taskAssignment->getTask();
            }

            if ($task instanceof Task) {
                $task = $this->fullfillTaskEntity($task, $calendarEvent, $taskData);

                $this->entityManager->persist($task);
                $this->entityManager->flush();

                $this->taskEventGeneratorService->generateEvents($task, $currentUser);
            } else {
                $task = new Task();
                $task = $this->fullfillTaskEntity($task, $calendarEvent, $taskData);

                $this->entityManager->persist($task);
                $this->entityManager->flush();

                $this->taskEventGeneratorService->generateEvents($task, $currentUser);

                // Don't persist the original event - it was just a template (maybe let it in place for creator as reference?)
                $this->entityManager->remove($calendarEvent);
            }
        }

        /** @var ConstraintViolationList $errors */
        $errors = $this->validator->validate($calendarEvent);

        if ($calendarEvent->getGame()) {
            $gameErrors = $this->validator->validate($calendarEvent->getGame());
            foreach ($gameErrors as $gameError) {
                $errors->add($gameError);
            }
        }

        if ($errors->count()) {
            return $errors;
        }

        $this->entityManager->flush();

        if (isset($data['permissionType']) && !isset($data['task'])) {
            $this->updatePermissionsForEvent($calendarEvent, $data['permissionType'], $data);
            $this->entityManager->persist($calendarEvent);
            $this->entityManager->flush();
        } elseif (!$calendarEvent->getId() && !isset($data['task'])) {
            $this->createDefaultPermissionsForEvent($calendarEvent);
            $this->entityManager->persist($calendarEvent);
            $this->entityManager->flush();
        }

        if ($gameCreated && $calendarEvent->getGame()) {
            $this->eventDispatcher->dispatch(new GameCreatedEvent($calendarEvent->getGame()));
        }

        return new ConstraintViolationList();
    }

    /**
     * @param array<string, mixed> $data
     */
    private function processTournament(CalendarEvent $calendarEvent, array $data): void
    {
        $tournamentRepo = $this->entityManager->getRepository(Tournament::class);
        $tournamentMatchRepo = $this->entityManager->getRepository(TournamentMatch::class);

        $tournament = $calendarEvent->getTournament() ?? null;
        $tournamentData = $data['game'] ?? $data;

        if (!$tournament) {
            $tournament = new Tournament();
            $tournament->setCalendarEvent($calendarEvent);
            $currentUser = $this->security->getUser();
            if ($currentUser instanceof User) {
                $tournament->setCreatedBy($currentUser);
            }
            $this->entityManager->persist($tournament);
            $calendarEvent->setTournament($tournament);
        }

        $settings = $tournament->getSettings() ?: [];
        if (isset($tournamentData['tournamentType'])) {
            $settings['type'] = $tournamentData['tournamentType'];
        }
        if (isset($tournamentData['tournamentRoundDuration'])) {
            $settings['roundDuration'] = $tournamentData['tournamentRoundDuration'];
        }
        if (isset($tournamentData['tournamentBreakTime'])) {
            $settings['breakTime'] = $tournamentData['tournamentBreakTime'];
        }
        if (isset($tournamentData['tournamentGameMode'])) {
            $settings['gameMode'] = $tournamentData['tournamentGameMode'];
        }
        if (isset($tournamentData['tournamentNumberOfGroups'])) {
            $settings['numberOfGroups'] = $tournamentData['tournamentNumberOfGroups'];
        }

        $tournament->setSettings($settings);

        $tournamentName = $tournamentData['name'] ?? $data['title'] ?? ('' !== $tournament->getName() ? $tournament->getName() : 'Turnier');
        $tournament->setName($tournamentName);

        $tournamentType = $settings['type'] ?? $tournamentData['tournamentType'] ?? ('' !== $tournament->getType() ? $tournament->getType() : 'default');
        $tournament->setType($tournamentType);

        if (isset($tournamentData['pendingTournamentMatches']) && is_array($tournamentData['pendingTournamentMatches'])) {
            // @TODO check, why this collection is empty but matches exists in db!
            // $existingMatches = $tournament->getMatches();
            $existingMatches = $this->entityManager->getRepository(TournamentMatch::class)->findBy(['tournament' => $tournament]);
            $processedMatches = [];
            $payloadMatchKeys = array_map(function ($m) {
                return $m['id'] ?? null;
            }, $tournamentData['pendingTournamentMatches']);
            foreach ($existingMatches as $match) {
                if (!in_array($match->getId(), $payloadMatchKeys)) {
                    $tournament->removeMatch($match);
                    $this->entityManager->remove($match);
                } else {
                    foreach ($tournamentData['pendingTournamentMatches'] as $matchKey => $matchData) {
                        $processedMatches[] = $matchData['id'] ?? null;

                        $this->processTournamentMatch($match, $matchData);
                    }
                }
            }

            foreach ($tournamentData['pendingTournamentMatches'] as $matchKey => $matchData) {
                if (isset($matchData['id']) && in_array($matchData['id'], $processedMatches, true)) {
                    continue;
                }
                $match = null;
                if (isset($matchData['id'])) {
                    $match = $tournamentMatchRepo->find($matchData['id']);
                }
                if (!$match) {
                    $match = new TournamentMatch();
                    $match->setTournament($tournament);
                    $this->entityManager->persist($match);
                    $tournament->addMatch($match);
                }

                $this->processTournamentMatch($match, $matchData);
            }
        }

        $this->entityManager->persist($tournament);
        $this->entityManager->flush();
    }

    /** @param array<string, mixed> $data */
    private function processTournamentMatch(TournamentMatch $match, array $data): TournamentMatch
    {
        $match->setScheduledAt($data['scheduledAt'] ? new DateTime($data['scheduledAt']) : null);
        $match->setHomeTeam(isset($data['homeTeamId']) ? $this->entityManager->getRepository(Team::class)->find((int) $data['homeTeamId']) : null);
        $match->setAwayTeam(isset($data['awayTeamId']) ? $this->entityManager->getRepository(Team::class)->find((int) $data['awayTeamId']) : null);
        $match->setRound($data['round'] ?? null);
        $match->setSlot($data['slot'] ?? null);
        $match->setStage($data['stage'] ?? null);
        $match->setLocation(isset($data['locationId']) && $data['locationId'] ?
            $this->entityManager->getRepository(Location::class)->find((int) $data['locationId']) :
                $match->getTournament()->getCalendarEvent()->getLocation() ?? null);
        $settings = $match->getTournament()->getSettings();

        $game = $match->getGame();

        if (!$game && $match->getHomeTeam() && $match->getAwayTeam()) {
            $gameType = $this->entityManager->getRepository(GameType::class)->findOneBy(['name' => 'Turnier-Match']);
            $eventType = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Turnier-Match']);
            if ($gameType && $eventType) {
                $game = new Game();
                $game->setHomeTeam($match->getHomeTeam());
                $game->setAwayTeam($match->getAwayTeam());
                $game->setGameType($gameType);

                $this->entityManager->persist($game);

                $match->setGame($game);

                $calendarEvent = new CalendarEvent();
                $calendarEvent->setTitle(('' !== $match->getHomeTeam()->getName() ? $match->getHomeTeam()->getName() : '-') .
                    ' vs ' . ('' !== $match->getAwayTeam()->getName() ? $match->getAwayTeam()->getName() : '-'));
                $calendarEvent->setStartDate($match->getScheduledAt() ?? new DateTime());
                $calendarEvent->setEndDate($match->getScheduledAt() && $calendarEvent->getStartDate() ?
                    DateTime::createFromInterface($calendarEvent->getStartDate())->modify('+' . $settings['roundDuration'] . ' minutes') : null);
                $calendarEvent->setCalendarEventType($eventType);
                $calendarEvent->setGame($game);

                $this->entityManager->persist($calendarEvent);
                $game->setCalendarEvent($calendarEvent);
            }
        } elseif ($game) {
            $game->setHomeTeam($match->getHomeTeam());
            $game->setAwayTeam($match->getAwayTeam());

            $calendarEvent = $game->getCalendarEvent();
            $calendarEvent->setTitle(('' !== $match->getHomeTeam()->getName() ? $match->getHomeTeam()->getName() : '-') .
                ' vs ' . ('' !== $match->getAwayTeam()->getName() ? $match->getAwayTeam()->getName() : '-'));
            $calendarEvent->setStartDate($match->getScheduledAt() ?? new DateTime());
            $calendarEvent->setEndDate($match->getScheduledAt() && $calendarEvent->getStartDate() ?
                DateTime::createFromInterface($calendarEvent->getStartDate())->modify('+' . $settings['roundDuration'] . ' minutes') : null);
            $calendarEvent->setGame($game);
            /* retrieve location from parent calendarEvent */
            $calendarEvent->setLocation($match->getTournament()->getCalendarEvent()->getLocation());
        }

        return $match;
    }

    /**
     * Verarbeitet das Update eines Turniers und seiner Matches/Games/Events für ein CalendarEvent.
     *
     * @param array<string, mixed> $data
     *
     * @phpstan-ignore method.unused
     */
    private function processTournamentUpdate(CalendarEvent $calendarEvent, array $data): void
    {
        $tournamentRepo = $this->entityManager->getRepository(Tournament::class);
        $tournamentMatchRepo = $this->entityManager->getRepository(TournamentMatch::class);
        $tournament = null;
        $tournamentData = $data['game'] ?? $data;
        if (isset($tournamentData['tournamentId']) && $tournamentData['tournamentId']) {
            $tournament = $tournamentRepo->find($tournamentData['tournamentId']);
        }

        if (!$tournament) {
            return;
        }

        $settings = $tournament->getSettings() ?: [];
        if (isset($tournamentData['tournamentType'])) {
            $settings['type'] = $tournamentData['tournamentType'];
        }
        if (isset($tournamentData['tournamentRoundDuration'])) {
            $settings['roundDuration'] = $tournamentData['tournamentRoundDuration'];
        }
        if (isset($tournamentData['tournamentBreakTime'])) {
            $settings['breakTime'] = $tournamentData['tournamentBreakTime'];
        }
        if (isset($tournamentData['tournamentGameMode'])) {
            $settings['gameMode'] = $tournamentData['tournamentGameMode'];
        }
        if (isset($tournamentData['tournamentNumberOfGroups'])) {
            $settings['numberOfGroups'] = $tournamentData['tournamentNumberOfGroups'];
        }

        $tournament->setSettings($settings);
        $tournamentName = $tournamentData['name'] ?? $data['title'] ?? ('' !== $tournament->getName() ? $tournament->getName() : 'Turnier');
        $tournament->setName($tournamentName);
        $tournamentType = $settings['type'] ?? $tournamentData['tournamentType'] ?? ('' !== $tournament->getType() ? $tournament->getType() : 'default');
        $tournament->setType($tournamentType);

        if (isset($tournamentData['pendingTournamentMatches']) && is_array($tournamentData['pendingTournamentMatches'])) {
            $existingMatches = $tournament->getMatches();
            $payloadMatchKeys = array_map(function ($m) {
                return $m['id'] ?? null;
            }, $tournamentData['pendingTournamentMatches']);
            foreach ($existingMatches as $match) {
                if (!in_array($match->getId(), $payloadMatchKeys)) {
                    $tournament->removeMatch($match);
                    $this->entityManager->remove($match);
                }
            }
            foreach ($tournamentData['pendingTournamentMatches'] as $mData) {
                $match = null;
                if (isset($mData['id'])) {
                    $match = $tournamentMatchRepo->find($mData['id']);
                }
                if (!$match) {
                    $match = new TournamentMatch();
                    $match->setTournament($tournament);
                    $this->entityManager->persist($match);
                    $tournament->addMatch($match);
                }
                // Setze Home/Away nur wenn numerisch
                $homeTeam = (isset($mData['homeTeamId']) && is_numeric($mData['homeTeamId']))
                    ? $this->entityManager->getRepository(Team::class)->find((int) $mData['homeTeamId'])
                    : null;
                $awayTeam = (isset($mData['awayTeamId']) && is_numeric($mData['awayTeamId']))
                    ? $this->entityManager->getRepository(Team::class)->find((int) $mData['awayTeamId'])
                    : null;
                $match->setHomeTeam($homeTeam);
                $match->setAwayTeam($awayTeam);
                // Nur wenn beide Teams numerisch und vorhanden sind, Game+Event anlegen
                if ($homeTeam && $awayTeam) {
                    $game = $match->getGame();
                    if (!$game) {
                        $gameType = $this->entityManager->getRepository(GameType::class)->findOneBy(['name' => 'Turnier-Match']);
                        $eventType = $this->entityManager->getRepository(CalendarEventType::class)->findOneBy(['name' => 'Turnier-Match']);
                        if ($gameType && $eventType) {
                            $game = new Game();
                            $game->setHomeTeam($homeTeam);
                            $game->setAwayTeam($awayTeam);
                            $game->setGameType($gameType);
                            $this->entityManager->persist($game);
                            $match->setGame($game);
                            $ce = new CalendarEvent();
                            $ce->setTitle(('' !== $homeTeam->getName() ? $homeTeam->getName() : '-') . ' vs ' . ('' !== $awayTeam->getName() ? $awayTeam->getName() : '-'));
                            $ce->setStartDate($match->getScheduledAt() ?? new DateTime());
                            $ce->setCalendarEventType($eventType);
                            $ce->setGame($game);
                            $game->setCalendarEvent($ce);
                            $this->entityManager->persist($ce);
                        }
                    } else {
                        $game->setHomeTeam($homeTeam);
                        $game->setAwayTeam($awayTeam);
                        $ce = $game->getCalendarEvent();
                        if ($ce) {
                            $ce->setTitle(('' !== $homeTeam->getName() ? $homeTeam->getName() : '-') . ' vs ' . ('' !== $awayTeam->getName() ? $awayTeam->getName() : '-'));
                            $ce->setStartDate($match->getScheduledAt() ?? new DateTime());
                        }
                    }
                } else {
                    // Wenn eines der Teams nicht numerisch, Game löschen
                    if ($match->getGame()) {
                        $this->entityManager->remove($match->getGame());
                        $match->setGame(null);
                    }
                }
                if (isset($mData['round'])) {
                    $match->setRound($mData['round']);
                }
                if (isset($mData['slot'])) {
                    $match->setSlot($mData['slot']);
                }
                if (isset($mData['scheduledAt'])) {
                    $match->setScheduledAt(new DateTime($mData['scheduledAt']));
                }
                if (isset($mData['status'])) {
                    $match->setStatus($mData['status']);
                }
            }
        }

        $this->entityManager->persist($tournament);
        $this->entityManager->flush();
    }

    /**
     * @param array<string, mixed> $taskData
     */
    public function fullfillTaskEntity(Task $task, CalendarEvent $calendarEvent, array $taskData): Task
    {
        $task->setTitle($calendarEvent->getTitle());
        $task->setDescription($calendarEvent->getDescription());
        $task->setIsRecurring($taskData['isRecurring'] ?? false);
        $task->setRecurrenceMode($taskData['recurrenceMode'] ?? 'classic');
        $task->setOffsetDays($taskData['offset'] ?? 0);

        // Set rotation users
        $rotationUsers = [];
        if (isset($taskData['rotationUsers']) && is_array($taskData['rotationUsers'])) {
            $rotationUsers = $this->entityManager->getRepository(User::class)
                ->findBy(['id' => $taskData['rotationUsers']]);
            $task->setRotationUsers(new ArrayCollection($rotationUsers));
        }

        $task->setRotationCount($taskData['rotationCount'] ?? 1);

        // Set recurrence rule for classic mode
        if ($task->isRecurring() && 'classic' === $task->getRecurrenceMode()) {
            if (isset($taskData['recurrenceRule']) && $taskData['recurrenceRule']) {
                $task->setRecurrenceRule($taskData['recurrenceRule']);
            }
        }

        /** @var User $currentUser */
        $currentUser = $this->security->getUser();
        $task->setCreatedBy($currentUser);

        return $task;
    }

    /**
     * Aktualisiert oder erstellt Permissions für ein Event basierend auf permissionType und IDs.
     *
     * @param array<string, mixed> $data
     */
    private function updatePermissionsForEvent(CalendarEvent $calendarEvent, string $permissionType, array $data = []): void
    {
        // Lösche alle existierenden Permissions
        foreach ($calendarEvent->getPermissions() as $permission) {
            $this->entityManager->remove($permission);
        }

        if ('public' === $permissionType) {
            // Public: eine PUBLIC Permission
            $permission = new CalendarEventPermission();
            $permission->setCalendarEvent($calendarEvent);
            $permission->setPermissionType(CalendarEventPermissionType::PUBLIC);
            $this->entityManager->persist($permission);
            $calendarEvent->addPermission($permission);
        } elseif ('user' === $permissionType && isset($data['permissionUsers'])) {
            // User: eine Permission pro User
            $userIds = $data['permissionUsers'];
            foreach ($userIds as $userId) {
                $user = $this->entityManager->getReference(User::class, (int) $userId);
                $permission = new CalendarEventPermission();
                $permission->setCalendarEvent($calendarEvent);
                $permission->setPermissionType(CalendarEventPermissionType::USER);
                $permission->setUser($user);
                $this->entityManager->persist($permission);
                $calendarEvent->addPermission($permission);
            }
        } elseif ('team' === $permissionType && isset($data['permissionTeams'])) {
            // Team: eine Permission pro Team
            $teamIds = $data['permissionTeams'];
            foreach ($teamIds as $teamId) {
                $team = $this->entityManager->getReference(Team::class, (int) $teamId);
                $permission = new CalendarEventPermission();
                $permission->setCalendarEvent($calendarEvent);
                $permission->setPermissionType(CalendarEventPermissionType::TEAM);
                $permission->setTeam($team);
                $this->entityManager->persist($permission);
                $calendarEvent->addPermission($permission);
            }
        } elseif ('club' === $permissionType && isset($data['permissionClubs'])) {
            // Club: eine Permission pro Club
            $clubIds = $data['permissionClubs'];
            foreach ($clubIds as $clubId) {
                $club = $this->entityManager->getReference(Club::class, (int) $clubId);
                $permission = new CalendarEventPermission();
                $permission->setCalendarEvent($calendarEvent);
                $permission->setPermissionType(CalendarEventPermissionType::CLUB);
                $permission->setClub($club);
                $this->entityManager->persist($permission);
                $calendarEvent->addPermission($permission);
            }
        }
    }

    /**
     * Erstellt Standard-Permissions für ein neues Event basierend auf dem Event-Typ.
     */
    private function createDefaultPermissionsForEvent(CalendarEvent $calendarEvent): void
    {
        $eventType = $calendarEvent->getCalendarEventType();

        // Für Spiel- und Aufgaben-Events keine Standard-Permissions erstellen
        if (null === $eventType || in_array($eventType->getName(), ['Spiel', 'Aufgabe'])) {
            return;
        }

        // Andere Events: standardmäßig öffentlich
        $permission = new CalendarEventPermission();
        $permission->setCalendarEvent($calendarEvent);
        $permission->setPermissionType(CalendarEventPermissionType::PUBLIC);
        $this->entityManager->persist($permission);
        $calendarEvent->addPermission($permission);
    }

    /** @return User[] */
    public function loadEventRecipients(CalendarEvent $calendarEvent): array
    {
        return $this->teamMembershipService->resolveEventRecipients($calendarEvent);
    }
}
