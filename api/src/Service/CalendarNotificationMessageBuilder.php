<?php

namespace App\Service;

use App\Dto\CalendarEventChangeSet;
use App\Entity\CalendarEvent;
use App\Event\CalendarEventDeletedEvent;
use App\Event\CalendarEventUpdatedEvent;

/**
 * Builds human-readable push notification title and body for calendar events.
 *
 * This is a pure, stateless service with no external dependencies.
 * The subscriber calls these methods and appends any recipient-hint suffix itself.
 */
class CalendarNotificationMessageBuilder
{
    /**
     * @return array{title: string, body: string}
     */
    public function forCreated(CalendarEvent $calendarEvent): array
    {
        $isTraining    = null !== $calendarEvent->getTrainingSeriesId();
        $seriesEndDate = $calendarEvent->getTrainingSeriesEndDate();
        $startDt       = $calendarEvent->getStartDate();
        $endDt         = $calendarEvent->getEndDate();
        $locationObj   = $calendarEvent->getLocation();
        $game          = $calendarEvent->getGame();
        $lines         = [];

        if ($isTraining && null !== $seriesEndDate) {
            $title = 'Neue Trainings: ' . $calendarEvent->getTitle();
            $endDateFmt = (new \DateTimeImmutable($seriesEndDate))->format('d.m.Y');
            $lines[] = 'Es wurden neue Trainings angelegt.';
            if (null !== $startDt) {
                $lines[] = '📅 ' . $startDt->format('d.m.Y') . ' bis ' . $endDateFmt;
                $timeStr  = $startDt->format('H:i');
                $timeStr .= null !== $endDt ? '–' . $endDt->format('H:i') . ' Uhr' : ' Uhr';
                $lines[] = '⏰ Uhrzeit: ' . $timeStr;
            }
            if (null !== $locationObj) {
                $lines[] = '📍 Ort: ' . $locationObj->getName();
            }
        } elseif (null !== $game) {
            $home  = $game->getHomeTeam()?->getName() ?? '?';
            $away  = $game->getAwayTeam()?->getName() ?? '?';
            $title = 'Neues Spiel: ' . $calendarEvent->getTitle();
            $lines[] = $home . ' vs. ' . $away;
            if (null !== $startDt) {
                $timeStr  = $startDt->format('d.m.Y') . ' · ' . $startDt->format('H:i');
                $timeStr .= null !== $endDt ? '–' . $endDt->format('H:i') . ' Uhr' : ' Uhr';
                $lines[] = '📅 ' . $timeStr;
            }
            if (null !== $locationObj) {
                $lines[] = '📍 Ort: ' . $locationObj->getName();
            }
        } else {
            $title = ($isTraining ? 'Neues Training: ' : 'Neuer Termin: ') . $calendarEvent->getTitle();
            if (null !== $startDt) {
                $timeStr  = $startDt->format('d.m.Y') . ' · ' . $startDt->format('H:i');
                $timeStr .= null !== $endDt ? '–' . $endDt->format('H:i') . ' Uhr' : ' Uhr';
                $lines[] = '📅 ' . $timeStr;
            }
            if (null !== $locationObj) {
                $lines[] = '📍 Ort: ' . $locationObj->getName();
            }
        }

        return ['title' => $title, 'body' => implode("\n", $lines)];
    }

    /**
     * @return array{title: string, body: string}
     */
    public function forUpdated(CalendarEventUpdatedEvent $event): array
    {
        $calendarEvent = $event->getCalendarEvent();
        $updatedCount  = $event->getUpdatedCount();
        $changeSet     = $event->getChangeSet();

        $eventTitle  = $calendarEvent->getTitle();
        $isTraining  = null !== $calendarEvent->getTrainingSeriesId();
        $termPost    = $isTraining ? 'Training' : 'Termin';
        $termPlural  = $isTraining ? 'Trainings' : 'Termine';
        $location    = $calendarEvent->getLocation();
        $startDt     = $calendarEvent->getStartDate();
        $dateFmt     = null !== $startDt ? $startDt->format('d.m.Y') : null;

        $oldEndDate      = $event->getOldSeriesEndDate();
        $newEndDate      = $event->getNewSeriesEndDate();
        $endDateChanged   = $updatedCount > 1 && null !== $newEndDate && $oldEndDate !== $newEndDate;
        $endDateExtended  = $endDateChanged && null !== $oldEndDate && $newEndDate > $oldEndDate;
        $endDateShortened = $endDateChanged && null !== $oldEndDate && $newEndDate < $oldEndDate;

        $title = ($updatedCount > 1 ? $termPlural : $termPost) . ' geändert: ' . $eventTitle;
        $lines = [];

        // ── Overview line ────────────────────────────────────────────────────
        if ($updatedCount > 1) {
            if (null !== $changeSet && !$changeSet->isEmpty()) {
                // Actual data changed → say which date the change starts from.
                $lines[] = null !== $dateFmt
                    ? 'Die ' . $termPlural . ' ab ' . $dateFmt . ' haben sich geändert.'
                    : 'Die ' . $termPlural . ' wurden aktualisiert.';
            }
        } else {
            if (null !== $dateFmt) {
                $lines[] = ($isTraining ? 'Das Training' : 'Der Termin') . ' am ' . $dateFmt . ' hat sich geändert.';
            }
        }

        // ── Time / weekday change ────────────────────────────────────────────
        if (null !== $changeSet && ($changeSet->timeChanged() || $changeSet->weekdayChanged())) {
            $lines[] = $this->buildTimeChangeLine($changeSet);
        }

        // ── Location change (or current location as context) ─────────────────
        if (null !== $changeSet && $changeSet->locationChanged()) {
            $lines[] = $this->buildLocationChangeLine($changeSet);
        } elseif (null !== $location) {
            $lines[] = '📍 Ort: ' . $location->getName();
        }

        // ── Series end-date changes (cumulative – always shown when applicable) ─
        if ($endDateExtended) {
            $newFmt  = (new \DateTimeImmutable($newEndDate))->format('d.m.Y');
            $lines[] = 'Neue ' . $termPlural . ' bis zum ' . $newFmt . ' wurden hinzugefügt.';
        }
        if ($endDateShortened) {
            $oldFmt      = $oldEndDate ? (new \DateTimeImmutable($oldEndDate))->format('d.m.Y') : '?';
            $deletedFrom = (new \DateTimeImmutable($newEndDate))->modify('+1 day')->format('d.m.Y');
            $lines[]     = 'Die ' . $termPlural . ' vom ' . $deletedFrom . ' bis ' . $oldFmt . ' wurden abgesagt.';
        }

        // ── Fallback when nothing specific was captured ──────────────────────
        if (empty($lines) && $updatedCount > 1) {
            $lines[] = null !== $dateFmt
                ? 'Infos zu den ' . $termPlural . ' ab ' . $dateFmt . ' wurden aktualisiert.'
                : 'Die ' . $termPlural . ' wurden aktualisiert.';
        }

        return ['title' => $title, 'body' => implode("\n", $lines)];
    }

    /**
     * Formats "⏰ Uhrzeit: [Mo] 18:00–19:30 Uhr → [Di] 19:00–20:45 Uhr".
     */
    private function buildTimeChangeLine(CalendarEventChangeSet $changeSet): string
    {
        $oldDay   = $changeSet->oldWeekday ? $changeSet->oldWeekday . ' ' : '';
        $newDay   = $changeSet->newWeekday ? $changeSet->newWeekday . ' ' : '';
        $oldRange = ($changeSet->oldStartTime ?? '') . ($changeSet->oldEndTime ? '–' . $changeSet->oldEndTime : '') . ' Uhr';
        $newRange = ($changeSet->newStartTime ?? '') . ($changeSet->newEndTime ? '–' . $changeSet->newEndTime : '') . ' Uhr';

        return '⏰ Uhrzeit: ' . $oldDay . $oldRange . ' → ' . $newDay . $newRange;
    }

    /**
     * Formats "📍 Ort: OldName → NewName".
     */
    private function buildLocationChangeLine(CalendarEventChangeSet $changeSet): string
    {
        $oldName = $changeSet->oldLocationName ?? '(kein Ort)';
        $newName = $changeSet->newLocationName ?? '(kein Ort)';

        return '📍 Ort: ' . $oldName . ' → ' . $newName;
    }

    /**
     * @return array{title: string, body: string}
     */
    public function forDeleted(CalendarEventDeletedEvent $event): array
    {
        $calendarEvent    = $event->getCalendarEvent();
        $deletedCount     = $event->getDeletedCount();
        $firstDeletedDate = $event->getFirstDeletedDate();
        $lastDeletedDate  = $event->getLastDeletedDate();

        $eventTitle = $calendarEvent->getTitle();
        $isTraining = null !== $calendarEvent->getTrainingSeriesId();
        $termPost   = $isTraining ? 'Training' : 'Termin';
        $termPlural = $isTraining ? 'Trainings' : 'Termine';
        $location   = $calendarEvent->getLocation();
        $lines      = [];

        if ($deletedCount > 1) {
            $title = $termPlural . ' abgesagt: ' . $eventTitle;

            if ($firstDeletedDate && $lastDeletedDate && $firstDeletedDate !== $lastDeletedDate) {
                $lines[] = 'Die ' . $termPlural . ' vom ' . $firstDeletedDate . ' bis ' . $lastDeletedDate . ' wurden abgesagt.';
            } elseif ($firstDeletedDate) {
                $lines[] = 'Die ' . $termPlural . ' ab ' . $firstDeletedDate . ' wurden abgesagt.';
            } else {
                $lines[] = 'Die ' . $termPlural . ' wurden abgesagt.';
            }

            if (null !== $location) {
                $lines[] = '📍 Ort: ' . $location->getName();
            }
        } else {
            $title   = $termPost . ' abgesagt: ' . $eventTitle;
            $startDt = $calendarEvent->getStartDate();
            if (null !== $startDt) {
                $endDt   = $calendarEvent->getEndDate();
                $timeStr = $startDt->format('d.m.Y') . ' · ' . $startDt->format('H:i');
                $timeStr .= null !== $endDt ? '–' . $endDt->format('H:i') . ' Uhr' : ' Uhr';
                $lines[] = '📅 ' . $timeStr;
            }
            if (null !== $location) {
                $lines[] = '📍 ' . $location->getName();
            }
            $lines[] = ($isTraining ? 'Dieses Training' : 'Dieser Termin') . ' entfällt.';
        }

        return ['title' => $title, 'body' => implode("\n", $lines)];
    }
}
