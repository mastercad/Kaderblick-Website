<?php

namespace App\Controller;

use App\Entity\CalendarEvent;
use App\Entity\User;
use App\Repository\CalendarEventRepository;
use App\Repository\UserRepository;
use App\Service\UserTeamAccessService;
use DateTime;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Public iCal feed endpoints – no authentication required, secured via a
 * per-user calendar token that can be rotated at any time.
 *
 * URL pattern:  /ical/{token}/{scope}.ics
 * Scopes:
 *   personal  – all events that are visible to the token owner
 *   club      – events with "club" permission type
 *   platform  – all public events (permission type "public")
 */
#[Route('/ical', name: 'ical_')]
class ICalController extends AbstractController
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly CalendarEventRepository $calendarEventRepository,
        private readonly UserTeamAccessService $teamAccessService,
    ) {
    }

    /** Nur Tokens mit diesem Präfix werden akzeptiert. */
    private const CALENDAR_TOKEN_PREFIX = 'kcal_';

    #[Route('/{token}/{scope}.ics', name: 'feed', methods: ['GET'])]
    public function feed(string $token, string $scope): Response
    {
        // Präfix-Prüfung: verhindert, dass API-Tokens oder JWTs hier
        // missbraucht werden können.
        if (!str_starts_with($token, self::CALENDAR_TOKEN_PREFIX)) {
            return new Response(
                "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Fussballverein//iCal//DE\r\nX-WR-CALNAME:Ungültiger Token\r\nEND:VCALENDAR\r\n",
                404,
                ['Content-Type' => 'text/calendar; charset=UTF-8']
            );
        }

        /** @var ?User $user */
        $user = $this->userRepository->findOneBy(['calendarToken' => $token]);

        if (!$user) {
            return new Response(
                "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Fussballverein//iCal//DE\r\nX-WR-CALNAME:Ungültiger Token\r\nEND:VCALENDAR\r\n",
                404,
                ['Content-Type' => 'text/calendar; charset=UTF-8']
            );
        }

        $scope = strtolower($scope);
        if (!in_array($scope, ['personal', 'club', 'platform'], true)) {
            $scope = 'personal';
        }

        // Events für die nächsten 12 Monate und die vergangenen 6 Monate
        $start = new DateTime('-6 months');
        $end = new DateTime('+12 months');

        /** @var CalendarEvent[] $allEvents */
        $allEvents = $this->calendarEventRepository->findBetweenDates($start, $end);

        $events = array_filter($allEvents, function (CalendarEvent $event) use ($scope, $user): bool {
            $permissions = $event->getPermissions();

            // Kein Eintrag = öffentlich
            if ($permissions->isEmpty()) {
                return true;
            }

            $types = array_map(
                fn ($p) => $p->getPermissionType()->value,
                $permissions->toArray()
            );

            return match ($scope) {
                'platform' => in_array('public', $types, true),
                'club' => count(array_intersect($types, ['public', 'club'])) > 0,
                default => $this->isEventVisibleToUser($event, $user),
            };
        });

        $calName = match ($scope) {
            'personal' => 'Mein Kalender',
            'club' => 'Vereinskalender',
            default => 'Plattformkalender',
        };

        $ical = $this->buildIcal($calName, array_values($events));

        return new Response($ical, 200, [
            'Content-Type' => 'text/calendar; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="%s.ics"', $scope),
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function isEventVisibleToUser(CalendarEvent $event, User $user): bool
    {
        $permissions = $event->getPermissions();

        // Kein Berechtigungs-Eintrag → öffentlich sichtbar
        if ($permissions->isEmpty()) {
            return true;
        }

        foreach ($permissions as $perm) {
            $type = $perm->getPermissionType()->value;

            if ('public' === $type || 'club' === $type) {
                return true;
            }

            if ('team' === $type) {
                $team = $perm->getTeam();
                if (null !== $team && $this->isUserInTeam($user, $event, $team)) {
                    return true;
                }
            }

            if ('user' === $type && $perm->getUser()?->getId() === $user->getId()) {
                return true;
            }
        }

        return false;
    }

    private function isUserInTeam(User $user, CalendarEvent $event, \App\Entity\Team $team): bool
    {
        $eventDate = $event->getStartDate();
        $playerTeams = $this->teamAccessService->getPlayerTeamsForDate($user, [$team], $eventDate);
        if (!empty($playerTeams)) {
            return true;
        }
        $coachTeams = $this->teamAccessService->getCoachTeamsForDate($user, [$team], $eventDate);

        return !empty($coachTeams);
    }

    /** @param CalendarEvent[] $events */
    private function buildIcal(string $calName, array $events): string
    {
        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Fussballverein Platform//iCal Feed//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' . $this->escapeText($calName),
            'X-WR-TIMEZONE:Europe/Berlin',
            'X-WR-CALDESC:Automatisch generierter Kalender-Feed',
        ];

        foreach ($events as $event) {
            $lines = array_merge($lines, $this->buildVevent($event));
        }

        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", $lines) . "\r\n";
    }

    /** @return string[] */
    private function buildVevent(CalendarEvent $event): array
    {
        $startDate = $event->getStartDate();
        $endDate = $event->getEndDate()
            ?? DateTime::createFromInterface($startDate ?? new DateTime())->modify('+1 hour')
            ?: new DateTime('+1 hour');

        $uid = sprintf(
            '%s-%d@fussballverein-platform',
            $startDate->format('Ymd'),
            $event->getId()
        );

        $lines = [
            'BEGIN:VEVENT',
            'UID:' . $uid,
            'DTSTAMP:' . (new DateTime())->format('Ymd\THis\Z'),
            'DTSTART:' . $startDate->format('Ymd\THis'),
            'DTEND:' . $endDate->format('Ymd\THis'),
            'SUMMARY:' . $this->escapeText(($event->isCancelled() ? '[ABGESAGT] ' : '') . ($event->getTitle() ?? '')),
        ];

        if ($event->getDescription()) {
            $lines[] = 'DESCRIPTION:' . $this->escapeText($event->getDescription());
        }

        if ($event->getLocation()?->getName()) {
            $lines[] = 'LOCATION:' . $this->escapeText($event->getLocation()->getName());
        }

        if ($event->isCancelled()) {
            $lines[] = 'STATUS:CANCELLED';
        } else {
            $lines[] = 'STATUS:CONFIRMED';
        }

        $lines[] = 'END:VEVENT';

        return $lines;
    }

    private function escapeText(string $text): string
    {
        $text = str_replace(['\\', ';', ',', "\n"], ['\\\\', '\\;', '\\,', '\\n'], $text);

        // Fold long lines (iCal max 75 octets per line)
        return $this->foldLine($text);
    }

    private function foldLine(string $text): string
    {
        // Simple folding – split on whitespace boundary close to 70 chars
        if (mb_strlen($text) <= 70) {
            return $text;
        }
        $result = '';
        while (mb_strlen($text) > 70) {
            $result .= mb_substr($text, 0, 70) . "\r\n ";
            $text = mb_substr($text, 70);
        }

        return $result . $text;
    }
}
