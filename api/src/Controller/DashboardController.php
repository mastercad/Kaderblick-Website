<?php

namespace App\Controller;

use App\Entity\DashboardWidget;
use App\Entity\FunctionaryTeamAssignment;
use App\Entity\PlayerTeamAssignment;
use App\Entity\ReportDefinition;
use App\Entity\StaffTeamAssignment;
use App\Entity\User;
use App\Repository\CalendarEventRepository;
use App\Repository\DashboardWidgetRepository;
use App\Repository\MessageRepository;
use App\Repository\NewsRepository;
use App\Service\DefaultDashboardService;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/', name: 'app_dashboard_')]
class DashboardController extends AbstractController
{
    public function __construct(
        private CalendarEventRepository $calendarRepo,
        private MessageRepository $messagesRepo,
        private NewsRepository $newsRepo,
        private DefaultDashboardService $defaultDashboardService,
        private EntityManagerInterface $em,
    ) {
    }

    #[Route('/', name: 'index')]
    public function index(DashboardWidgetRepository $widgetRepo, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();

        if (!$user) {
            return $this->json(['error' => 'Not authenticated'], 401);
        }

        $widgets = $widgetRepo->findBy(
            ['user' => $user, 'isEnabled' => true],
            ['position' => 'ASC']
        );

        $hasDefaultDashboardWidget = $this->checkDashboardIsDefault($widgets);

        // First-time user, or widgets were never created (e.g. silent error during
        // e-mail verification) → create them on-the-fly so the dashboard is never empty.
        if (empty($widgets) && $user instanceof User) {
            $this->defaultDashboardService->createDefaultDashboard($user);

            $widgets = $widgetRepo->findBy(
                ['user' => $user, 'isEnabled' => true],
                ['position' => 'ASC']
            );
        }

        // Verwaiste Report-Widgets entfernen (ReportDefinition gelöscht → SET NULL)
        $widgets = array_values(array_filter($widgets, function ($widget) use ($em) {
            if ('report' === $widget->getType() && null === $widget->getReportDefinition()) {
                $em->remove($widget);

                return false;
            }

            return true;
        }));
        $em->flush();

        $result = array_map(function ($widget) use ($hasDefaultDashboardWidget) {
            $report = $widget->getReportDefinition();

            return [
                'id' => $widget->getId(),
                'type' => $widget->getType(),
                'name' => 'report' === $widget->getType() && $report ? $report->getName() : null,
                'description' => 'report' === $widget->getType() && $report ? $report->getDescription() : null,
                'width' => $widget->getWidth(),
                'position' => $widget->getPosition(),
                'config' => $widget->getConfig(),
                'isDefault' => $widget->isDefault(),
                'isEnabled' => $widget->isEnabled(),
                'reportId' => $report?->getId(),
                'hasDefaultDashboardWidget' => $hasDefaultDashboardWidget
            ];
        }, $widgets);

        return $this->json(['widgets' => $result]);
    }

    #[IsGranted('IS_AUTHENTICATED')]
    #[Route('/widget/{id}', name: 'widget', methods: ['GET'])]
    public function widget(DashboardWidget $widget): JsonResponse
    {
        if ($widget->getUser() !== $this->getUser() && false === $widget->isDefault()) {
            throw $this->createAccessDeniedException();
        }

        return $this->json($this->retrieveWidgetContent($widget));
    }

    #[IsGranted('IS_AUTHENTICATED')]
    #[Route('/widget/{id}/content', name: 'widget_content')]
    public function widgetContent(DashboardWidget $widget): Response
    {
        $data = $this->retrieveWidgetContent($widget);
        // Für news und messages: Nur das relevante Array als JSON liefern
        if ('news' === $widget->getType() && isset($data['news'])) {
            return $this->json(['news' => $data['news']]);
        }
        if ('messages' === $widget->getType() && isset($data['messages'])) {
            return $this->json(['messages' => $data['messages']]);
        }

        // Standard: alles zurückgeben
        return $this->json($data);
    }

    #[IsGranted('IS_AUTHENTICATED')]
    #[Route('/app/dashboard/widgets/update', name: 'widgets_update', methods: ['PUT'])]
    public function updateWidgets(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        /** @var ?User $user */
        $user = $this->getUser();

        if (!isset($data['widgets']) || !is_array($data['widgets'])) {
            return $this->json(['error' => 'Invalid data format'], 400);
        }

        foreach ($data['widgets'] as $widgetData) {
            $widget = $em->getRepository(DashboardWidget::class)->find($widgetData['id']);

            if ($widget && $widget->getUser() === $user) {
                $widget->setPosition($widgetData['position']);
                $widget->setWidth($widgetData['width']);
                $widget->setEnabled($widgetData['enabled'] ?? true);
                $widget->setDefault($widgetData['default'] ?? false);

                if (isset($widgetData['config'])) {
                    $widget->setConfig($widgetData['config']);
                }
            } elseif ($widget && $widget->getUser() !== $user && $widget->isDefault()) {
                $newWidget = new DashboardWidget();
                $newWidget->setUser($user);
                $newWidget->setType($widget->getType());
                $newWidget->setPosition($widgetData['position']);
                $newWidget->setWidth($widgetData['width']);
                $newWidget->setEnabled(true);
                $newWidget->setDefault(false);

                if (isset($widgetData['config'])) {
                    $newWidget->setConfig($widgetData['config']);
                }

                // ReportDefinition mitkopieren, falls vorhanden
                if ($widget->getReportDefinition()) {
                    $origReport = $widget->getReportDefinition();
                    $reportCopy = new ReportDefinition();
                    $reportCopy->setName($origReport->getName());
                    $reportCopy->setDescription($origReport->getDescription());
                    $reportCopy->setConfig($origReport->getConfig());
                    $reportCopy->setIsTemplate($origReport->isTemplate());
                    $em->persist($reportCopy);
                    $newWidget->setReportDefinition($reportCopy);
                }

                $em->persist($newWidget);
            }
        }

        $em->flush();

        return $this->json(['status' => 'success']);
    }

    #[IsGranted('IS_AUTHENTICATED')]
    #[Route('/app/dashboard/widget/update', name: 'widget_update', methods: ['PUT'])]
    public function updateWidget(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        /** @var ?User $user */
        $user = $this->getUser();

        $widget = $em->getRepository(DashboardWidget::class)->find($data['id']);

        if ($widget && $widget->getUser() === $user) {
            $widget->setPosition($data['position']);
            $widget->setWidth($data['width']);
            $widget->setEnabled($data['enabled'] ?? true);
            if (isset($data['config'])) {
                $widget->setConfig($data['config']);
            }
            // Allow updating the linked report definition (e.g. after copying a template)
            if (isset($data['reportId'])) {
                $newReport = $em->getRepository(ReportDefinition::class)->find((int) $data['reportId']);
                if ($newReport && ($newReport->getUser() === $user || $newReport->isTemplate())) {
                    $widget->setReportDefinition($newReport);
                }
            }
        } elseif ($widget && $widget->getUser() !== $user && $widget->isDefault()) {
            $newWidget = new DashboardWidget();
            $newWidget->setUser($user);
            $newWidget->setType($widget->getType());
            $newWidget->setPosition($data['position']);
            $newWidget->setWidth($data['width']);
            $newWidget->setEnabled(true);
            $newWidget->setDefault(false);

            if (isset($data['config'])) {
                $newWidget->setConfig($data['config']);
            }

            // ReportDefinition mitkopieren, falls vorhanden
            if ($widget->getReportDefinition()) {
                $origReport = $widget->getReportDefinition();
                $reportCopy = new ReportDefinition();
                $reportCopy->setName($origReport->getName());
                $reportCopy->setDescription($origReport->getDescription());
                $reportCopy->setConfig($origReport->getConfig());
                $reportCopy->setIsTemplate($origReport->isTemplate());
                $em->persist($reportCopy);
                $newWidget->setReportDefinition($reportCopy);
            }

            $em->persist($newWidget);
        }

        $em->flush();

        return $this->json(['status' => 'success']);
    }

    #[IsGranted('IS_AUTHENTICATED')]
    #[Route('/app/dashboard/widgets/positions', name: 'widget_position', methods: ['PUT'])]
    public function updateWidgetPosition(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        foreach ($data['positions'] as $positionData) {
            $widgetId = $positionData['id'] ?? null;
            $newPosition = $positionData['position'] ?? null;

            if (null === $widgetId || null === $newPosition) {
                return $this->json(['error' => 'Invalid data'], 400);
            }

            /** @var ?DashboardWidget $widget */
            $widget = $em->getRepository(DashboardWidget::class)->find($widgetId);
            if (null === $widget) {
                return $this->json(['error' => 'Widget not found'], 404);
            }

            if ($widget->isDefault()) {
                continue;
            }

            $widget->setPosition($newPosition);
            $em->persist($widget);
        }
        $em->flush();

        return $this->json(['status' => 'success']);
    }

    /**
     * @return array<string, mixed>
     */
    #[IsGranted('IS_AUTHENTICATED')]
    private function retrieveWidgetContent(DashboardWidget $widget): array
    {
        /** @var User $user */
        $user = $this->getUser();

        return match ($widget->getType()) {
            'upcoming_events' => [
                'type' => 'upcoming_events',
                'events' => array_map(function ($event) {
                    return [
                        'id' => $event->getId(),
                        'title' => $event->getTitle(),
                        'startDate' => $event->getStartDate()?->format('c'),
                        'endDate' => $event->getEndDate()?->format('c'),
                        'location' => $event->getLocation() ? [
                            'id' => $event->getLocation()->getId(),
                            'name' => $event->getLocation()->getName(),
                            'latitude' => $event->getLocation()->getLatitude(),
                            'longitude' => $event->getLocation()->getLongitude(),
                            'address' => $event->getLocation()->getAddress(),
                        ] : null,
                        'calendarEventType' => [
                            'name' => $event->getCalendarEventType()?->getName(),
                            'color' => $event->getCalendarEventType()?->getColor(),
                        ],
                    ];
                }, $this->calendarRepo->findUpcoming())
            ],
            'calendar' => [
                'type' => 'calendar',
                // For calendar, frontend will fetch events as needed
            ],
            'messages' => [
                'type' => 'messages',
                'messages' => array_map(function ($msg) {
                    return [
                        'id' => $msg->getId(),
                        'subject' => $msg->getSubject(),
                        'sentAt' => $msg->getSentAt()?->format('c'),
                        'sender' => [
                            'id' => $msg->getSender()?->getId(),
                            'fullName' => $msg->getSender()?->getFullName(),
                        ],
                    ];
                }, $this->messagesRepo->findLatestForUser($user))
            ],
            'news' => [
                'type' => 'news',
                'news' => array_map(function ($item) {
                    return [
                        'id' => $item->getId(),
                        'title' => $item->getTitle(),
                        'createdAt' => $item->getCreatedAt()->format('c'),
                        'content' => $item->getContent(),
                        'visibility' => $item->getVisibility(),
                    ];
                }, $this->newsRepo->findForUser($user))
            ],
            'report' => [
                'type' => 'report',
                'reportId' => $widget->getReportDefinition()?->getId(),
                'reportName' => $widget->getReportDefinition()?->getName(),
                // Frontend will fetch report data as needed
            ],
            'birthdays' => $this->getBirthdayWidgetContent($user),
            default => [
                'type' => $widget->getType(),
                'error' => 'Widget type not implemented yet'
            ]
        };
    }

    /** @return array<string, mixed> */
    private function getBirthdayWidgetContent(User $user): array
    {
        $today = new DateTimeImmutable('today midnight');
        $tomorrow = $today->modify('+1 day');

        $teamIds = $this->getConnectedTeamIds($user, $today);

        if (empty($teamIds) && !$this->isGranted('ROLE_SUPERADMIN')) {
            return ['type' => 'birthdays', 'birthdays' => []];
        }

        $window = [];

        for ($i = 0; $i <= 7; ++$i) {
            $date = $today->modify("+{$i} days");
            $window[$date->format('m-d')] = $i;
        }

        $conn = $this->em->getConnection();

        $sql = <<<SQL
            SELECT pta.id
            FROM player_team_assignments pta
            INNER JOIN players p ON p.id = pta.player_id
            WHERE (pta.start_date IS NULL OR pta.start_date < :tomorrow)
            AND (pta.end_date IS NULL OR pta.end_date >= :today)
            AND p.birthdate IS NOT NULL
        SQL;

        $params = [
            'today' => $today->format('Y-m-d'),
            'tomorrow' => $tomorrow->format('Y-m-d'),
        ];

        $types = [];

        if (!empty($teamIds)) {
            $sql .= ' AND pta.team_id IN (:teamIds)';
            $params['teamIds'] = array_keys($teamIds);
            $types['teamIds'] = \Doctrine\DBAL\ArrayParameterType::INTEGER;
        }

        $birthdayConditions = [];

        foreach ($window as $monthDay => $daysUntil) {
            [$month, $day] = explode('-', $monthDay);

            $birthdayConditions[] = sprintf(
                '(MONTH(p.birthdate) = :birthMonth%d AND DAYOFMONTH(p.birthdate) = :birthDay%d)',
                $daysUntil,
                $daysUntil
            );

            $params["birthMonth{$daysUntil}"] = (int) $month;
            $params["birthDay{$daysUntil}"] = (int) $day;
        }

        $sql .= ' AND (' . implode(' OR ', $birthdayConditions) . ')';

        $assignmentIds = $conn->executeQuery($sql, $params, $types)->fetchFirstColumn();

        if (empty($assignmentIds)) {
            return ['type' => 'birthdays', 'birthdays' => []];
        }

        /** @var PlayerTeamAssignment[] $assignments */
        $assignments = $this->em->getRepository(PlayerTeamAssignment::class)
            ->createQueryBuilder('pta')
            ->join('pta.player', 'p')
            ->addSelect('p')
            ->join('pta.team', 't')
            ->addSelect('t')
            ->where('pta.id IN (:ids)')
            ->setParameter('ids', $assignmentIds)
            ->getQuery()
            ->getResult();

        $byPlayer = [];

        foreach ($assignments as $pta) {
            $player = $pta->getPlayer();
            $pid = $player->getId();

            if (!isset($byPlayer[$pid])) {
                $byPlayer[$pid] = [
                    'player' => $player,
                    'teams' => [],
                ];
            }

            $byPlayer[$pid]['teams'][] = $pta->getTeam()->getName();
        }

        $birthdays = [];

        foreach ($byPlayer as ['player' => $player, 'teams' => $teams]) {
            $birthdate = $player->getBirthdate();

            if (!$birthdate instanceof DateTimeInterface) {
                continue;
            }

            $monthDay = $birthdate->format('m-d');

            if (!isset($window[$monthDay])) {
                continue;
            }

            $daysUntil = $window[$monthDay];
            $birthdayDate = $today->modify("+{$daysUntil} days");

            $birthdays[] = [
                'id' => $player->getId(),
                'name' => $player->getFullName(),
                'birthdate' => $birthdate->format('Y-m-d'),
                'age' => (int) $birthdate->diff($birthdayDate)->y,
                'daysUntil' => $daysUntil,
                'teams' => array_values(array_unique($teams)),
            ];
        }

        usort(
            $birthdays,
            static fn (array $a, array $b): int => $a['daysUntil'] <=> $b['daysUntil']
                ?: $a['name'] <=> $b['name']
        );

        return ['type' => 'birthdays', 'birthdays' => $birthdays];
    }

    /** @return array<int, true> Team IDs keyed by ID */
    private function getConnectedTeamIds(User $user, DateTimeImmutable $today): array
    {
        $teamIds = [];

        // Via UserRelation → Player/Coach → team assignments
        foreach ($user->getUserRelations() as $rel) {
            if ($player = $rel->getPlayer()) {
                foreach ($player->getPlayerTeamAssignments() as $pta) {
                    if ($this->isActiveDateOnly($pta->getStartDate(), $pta->getEndDate(), $today)) {
                        $teamIds[$pta->getTeam()->getId()] = true;
                    }
                }
            }
            if ($coach = $rel->getCoach()) {
                foreach ($coach->getCoachTeamAssignments() as $cta) {
                    if ($this->isActiveDateOnly($cta->getStartDate(), $cta->getEndDate(), $today)) {
                        $teamIds[$cta->getTeam()->getId()] = true;
                    }
                }
            }
        }

        // Via direct StaffTeamAssignment
        foreach ($this->em->getRepository(StaffTeamAssignment::class)->findBy(['user' => $user]) as $sta) {
            if ($sta->getTeam() && $this->isActiveDateOnly($sta->getStartDate(), $sta->getEndDate(), $today)) {
                $teamIds[$sta->getTeam()->getId()] = true;
            }
        }

        // Via direct FunctionaryTeamAssignment
        foreach ($this->em->getRepository(FunctionaryTeamAssignment::class)->findBy(['user' => $user]) as $fta) {
            if ($fta->getTeam() && $this->isActiveDateOnly($fta->getStartDate(), $fta->getEndDate(), $today)) {
                $teamIds[$fta->getTeam()->getId()] = true;
            }
        }

        return $teamIds;
    }

    private function isActiveDateOnly(?DateTimeInterface $start, ?DateTimeInterface $end, DateTimeImmutable $today): bool
    {
        $todayStr = $today->format('Y-m-d');

        if (null !== $start && $start->format('Y-m-d') > $todayStr) {
            return false;
        }
        if (null !== $end && $end->format('Y-m-d') < $todayStr) {
            return false;
        }

        return true;
    }

    /**
     * @param DashboardWidget[] $widgets
     */
    private function checkDashboardIsDefault(array $widgets): bool
    {
        foreach ($widgets as $widget) {
            if ($widget->isDefault()) {
                return true;
            }
        }

        return false;
    }
}
