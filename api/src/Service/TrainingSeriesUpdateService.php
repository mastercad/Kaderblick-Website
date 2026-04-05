<?php

namespace App\Service;

use App\Dto\CalendarEventChangeSet;
use App\Dto\TrainingSeriesUpdateResult;
use App\Entity\CalendarEvent;
use App\Entity\CalendarEventPermission;
use App\Entity\User;
use App\Enum\CalendarEventPermissionType;
use DateTime;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Handles bulk updates of training-series calendar events.
 *
 * Extracted from CalendarController::updateCalendarEvent to keep the controller
 * thin and this complex logic independently testable.
 */
class TrainingSeriesUpdateService
{
    private const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly CalendarEventService $calendarEventService,
    ) {
    }

    /**
     * Applies a bulk update to all in-scope events of a training series.
     *
     * IMPORTANT: This method calls EntityManager::persist() for new events and
     * removes deleted ones, but does NOT call flush(). The caller is responsible
     * for flushing after dispatching the domain event.
     */
    /**
     * @param array<string, mixed> $data
     */
    public function update(
        CalendarEvent $calendarEvent,
        array $data,
        string $scope,
        User $currentUser,
    ): TrainingSeriesUpdateResult {
        $seriesId          = $calendarEvent->getTrainingSeriesId();
        $calendarEventRepo = $this->entityManager->getRepository(CalendarEvent::class);
        $seriesEvents      = $calendarEventRepo->findBy(['trainingSeriesId' => $seriesId]);

        $eventsToUpdate = match ($scope) {
            'series' => $seriesEvents,
            'from_here' => array_filter(
                $seriesEvents,
                fn (CalendarEvent $e) => $e->getStartDate() >= $calendarEvent->getStartDate()
            ),
            'same_weekday' => array_filter(
                $seriesEvents,
                fn (CalendarEvent $e) => $e->getStartDate()?->format('w') === $calendarEvent->getStartDate()?->format('w')
            ),
            'same_weekday_from_here' => array_filter(
                $seriesEvents,
                fn (CalendarEvent $e) => $e->getStartDate()?->format('w') === $calendarEvent->getStartDate()?->format('w')
                    && $e->getStartDate() >= $calendarEvent->getStartDate()
            ),
            default => [$calendarEvent],
        };

        // Optional upper bound: only update events up to (and including) this date.
        $untilDate = isset($data['trainingEditUntilDate'])
            ? new DateTimeImmutable($data['trainingEditUntilDate'] . 'T23:59:59')
            : null;
        if (null !== $untilDate) {
            $eventsToUpdate = array_filter(
                $eventsToUpdate,
                fn (CalendarEvent $e) => $e->getStartDate() <= $untilDate
            );
        }

        // ── Weekday-set change detection ──────────────────────────────────────
        $oldWeekdays     = array_map('intval', $calendarEvent->getTrainingWeekdays() ?? []);
        $newWeekdays     = array_key_exists('trainingWeekdays', $data)
            ? array_map('intval', (array) $data['trainingWeekdays'])
            : $oldWeekdays;
        $removedWeekdays = array_values(array_diff($oldWeekdays, $newWeekdays));
        $addedWeekdays   = array_values(array_diff($newWeekdays, $oldWeekdays));
        $keptWeekdays    = array_values(array_intersect($oldWeekdays, $newWeekdays));

        // Scope-range start: earliest event date in the scope.
        $scopeRangeStart = DateTimeImmutable::createFromInterface(
            $calendarEvent->getStartDate() ?? new DateTimeImmutable()
        );
        foreach ($eventsToUpdate as $e) {
            if ($e->getStartDate()) {
                $eStartIm = DateTimeImmutable::createFromInterface($e->getStartDate());
                if ($eStartIm < $scopeRangeStart) {
                    $scopeRangeStart = $eStartIm;
                }
            }
        }

        $oldSeriesEndDateStr = $calendarEvent->getTrainingSeriesEndDate();
        $newSeriesEndDateStr = (array_key_exists('trainingSeriesEndDate', $data) && $data['trainingSeriesEndDate'])
            ? $data['trainingSeriesEndDate']
            : $oldSeriesEndDateStr;
        $createUntil = $untilDate ?? ($newSeriesEndDateStr ? new DateTimeImmutable($newSeriesEndDateStr . 'T23:59:59') : null);

        // ── Time / duration helpers ────────────────────────────────────────────
        $originalStart = new DateTimeImmutable($data['startDate']);
        $originalEnd   = isset($data['endDate']) ? new DateTimeImmutable($data['endDate']) : null;
        $timeDiff      = $originalEnd ? $originalStart->diff($originalEnd) : null;
        $newTime       = $originalStart->format('H:i:s');

        // Capture old values for the ChangeSet before touching the entities.
        $oldStartTimeFmt = $calendarEvent->getStartDate()?->format('H:i');
        $oldEndTimeFmt   = $calendarEvent->getEndDate()?->format('H:i');
        $oldLocationName = $calendarEvent->getLocation()?->getName();

        // ── 1. Update existing scoped events (or delete if weekday was removed) ─
        $endDateShortened = $oldSeriesEndDateStr && $newSeriesEndDateStr
            && $newSeriesEndDateStr < $oldSeriesEndDateStr;
        $shortCutOff = $endDateShortened
            ? new DateTimeImmutable($newSeriesEndDateStr . 'T23:59:59')
            : null;

        $updatedCount = 0;
        foreach ($eventsToUpdate as $event) {
            $eventWeekdayNum = (int) $event->getStartDate()?->format('w');
            if (!empty($removedWeekdays) && in_array($eventWeekdayNum, $removedWeekdays, true)) {
                $this->calendarEventService->deleteCalendarEventWithDependencies($event);
                continue;
            }
            if (null !== $shortCutOff && null !== $event->getStartDate() && $event->getStartDate() > $shortCutOff) {
                $this->calendarEventService->deleteCalendarEventWithDependencies($event);
                continue;
            }
            $eventDate    = $event->getStartDate()?->format('Y-m-d') ?? $originalStart->format('Y-m-d');
            $perEventData = array_merge($data, ['startDate' => $eventDate . 'T' . $newTime]);
            if ($originalEnd && $timeDiff) {
                $newEndDt = new DateTime($eventDate . 'T' . $newTime);
                $newEndDt->add($timeDiff);
                $perEventData['endDate'] = $newEndDt->format('Y-m-d\TH:i:s');
            }
            $this->calendarEventService->updateEventFromData($event, $perEventData);
            ++$updatedCount;
        }

        // ── 2. Create new occurrences for added weekdays within the scope range ─
        if (!empty($addedWeekdays) && null !== $createUntil) {
            $cursor = $scopeRangeStart->setTime(0, 0, 0);
            while ($cursor <= $createUntil) {
                if (in_array((int) $cursor->format('w'), $addedWeekdays, true)) {
                    $this->persistNewSeriesEvent(
                        $cursor, $newTime, $timeDiff, $originalEnd,
                        $calendarEvent, $newWeekdays, $newSeriesEndDateStr, $seriesId,
                        $currentUser
                    );
                    ++$updatedCount;
                }
                $cursor = $cursor->modify('+1 day');
            }
        }

        // ── 3. Extend series end date for kept weekdays (broad scopes only) ─────
        $endDateExtended = $oldSeriesEndDateStr && $newSeriesEndDateStr
            && $newSeriesEndDateStr > $oldSeriesEndDateStr;
        if ($endDateExtended && !empty($keptWeekdays)) {
            $editedWeekdayNum = (int) $calendarEvent->getStartDate()?->format('w');
            $scopeIsNarrow    = in_array($scope, ['same_weekday', 'same_weekday_from_here'], true);
            /** @var int[] $keptToExtend */
            $keptToExtend     = $scopeIsNarrow
                ? array_values(array_filter($keptWeekdays, fn (int $w) => $w === $editedWeekdayNum))
                : $keptWeekdays;

            if (!empty($keptToExtend)) {
                $existingEventDates  = [];
                $lastSeriesEventDate = null;
                foreach ($seriesEvents as $e) {
                    if ($e->getStartDate()) {
                        $d = DateTimeImmutable::createFromInterface($e->getStartDate());
                        $existingEventDates[$d->format('Y-m-d')] = true;
                        if (null === $lastSeriesEventDate || $d > $lastSeriesEventDate) {
                            $lastSeriesEventDate = $d;
                        }
                    }
                }
                $extStartFromConfig = (new DateTimeImmutable($oldSeriesEndDateStr . 'T00:00:00'))->modify('+1 day');
                $extStart           = (null !== $lastSeriesEventDate
                    && $lastSeriesEventDate->modify('+1 day') < $extStartFromConfig)
                    ? $lastSeriesEventDate->modify('+1 day')->setTime(0, 0, 0)
                    : $extStartFromConfig;
                $extEnd = $untilDate ?? new DateTimeImmutable($newSeriesEndDateStr . 'T23:59:59');
                if ($extStart <= $extEnd) {
                    $cursor = $extStart->setTime(0, 0, 0);
                    while ($cursor <= $extEnd) {
                        $cursorKey = $cursor->format('Y-m-d');
                        if (in_array((int) $cursor->format('w'), $keptToExtend, true)
                            && !isset($existingEventDates[$cursorKey])
                        ) {
                            $this->persistNewSeriesEvent(
                                $cursor, $newTime, $timeDiff, $originalEnd,
                                $calendarEvent, $newWeekdays, $newSeriesEndDateStr, $seriesId,
                                $currentUser
                            );
                            ++$updatedCount;
                            $existingEventDates[$cursorKey] = true;
                        }
                        $cursor = $cursor->modify('+1 day');
                    }
                }
            }
        }

        // ── 4. Silently sync trainingSeriesEndDate on out-of-scope events ─────
        if ($newSeriesEndDateStr !== $oldSeriesEndDateStr) {
            foreach ($seriesEvents as $event) {
                $event->setTrainingSeriesEndDate($newSeriesEndDateStr);
            }
        }

        // ── 5. Build the structured ChangeSet ─────────────────────────────────
        $newStartFmt    = $originalStart->format('H:i');
        $newEndFmt      = $originalEnd?->format('H:i');
        $newLocationName = $calendarEvent->getLocation()?->getName();

        $changeSet = new CalendarEventChangeSet(
            oldStartTime:    $oldStartTimeFmt,
            newStartTime:    $newStartFmt,
            oldEndTime:      $oldEndTimeFmt,
            newEndTime:      $newEndFmt,
            oldWeekday:      !empty($oldWeekdays) ? self::DAY_NAMES[reset($oldWeekdays)] : null,
            newWeekday:      !empty($newWeekdays) ? self::DAY_NAMES[reset($newWeekdays)] : null,
            oldLocationName: $oldLocationName,
            newLocationName: $newLocationName,
        );

        return new TrainingSeriesUpdateResult(
            updatedCount:    $updatedCount,
            changeSet:       $changeSet,
            oldSeriesEndDate: $oldSeriesEndDateStr,
            newSeriesEndDate: ($newSeriesEndDateStr !== $oldSeriesEndDateStr) ? $newSeriesEndDateStr : null,
        );
    }

    /**
     * Creates and persists a single CalendarEvent occurrence, cloning metadata
     * and permissions from $sourceEvent.
     *
     * @param int[] $newWeekdays
     */
    public function persistNewSeriesEvent(
        DateTimeImmutable $date,
        string $newTime,
        ?\DateInterval $timeDiff,
        ?DateTimeImmutable $originalEnd,
        CalendarEvent $sourceEvent,
        array $newWeekdays,
        ?string $seriesEndDateStr,
        string $seriesId,
        User $currentUser,
    ): void {
        $newEvent = new CalendarEvent();
        $newEvent->setTitle($sourceEvent->getTitle());
        $newEvent->setDescription($sourceEvent->getDescription());
        $newEvent->setCalendarEventType($sourceEvent->getCalendarEventType());
        $newEvent->setCreatedBy($currentUser);
        $newEvent->setLocation($sourceEvent->getLocation());
        $newEvent->setTrainingWeekdays($newWeekdays);
        $newEvent->setTrainingSeriesId($seriesId);
        $newEvent->setTrainingSeriesEndDate($seriesEndDateStr);

        $startDt = new DateTime($date->format('Y-m-d') . 'T' . $newTime);
        $newEvent->setStartDate($startDt);
        if ($originalEnd && $timeDiff) {
            $endDt = clone $startDt;
            $endDt->add($timeDiff);
            $newEvent->setEndDate($endDt);
        }

        foreach ($sourceEvent->getPermissions() as $perm) {
            $newPerm = new CalendarEventPermission();
            $newPerm->setPermissionType($perm->getPermissionType());
            $newPerm->setUser($perm->getUser());
            $newPerm->setTeam($perm->getTeam());
            $newPerm->setClub($perm->getClub());
            $newEvent->addPermission($newPerm);
        }

        $this->entityManager->persist($newEvent);
    }
}
