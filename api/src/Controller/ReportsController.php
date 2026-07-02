<?php

namespace App\Controller;

use App\Entity\DashboardWidget;
use App\Entity\ReportDefinition;
use App\Entity\User;
use App\Security\Voter\ReportVoter;
use App\Service\ReportDataService;
use App\Service\ReportFieldAliasService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class ReportsController extends AbstractController
{
    #[Route('/reports/preview', name: 'app_report_preview', methods: ['POST'])]
    public function preview(Request $request, EntityManagerInterface $em, ReportDataService $reportDataService): Response
    {
        /** @var User $user */
        $user = $this->getUser();
        $fieldAliases = ReportFieldAliasService::fieldAliases($em);
        $data = $request->request->all();
        $report = new ReportDefinition();
        $report->setName($data['name'] ?? '');
        $report->setDescription($data['description'] ?? null);
        $rawFilters = $data['config']['filters'] ?? [];
        $filters = [];
        foreach ($rawFilters as $k => $v) {
            if (null !== $v && '' !== $v) {
                $filters[$k] = $v;
            }
        }
        $config = [
            'diagramType' => $data['config']['diagramType'] ?? 'bar',
            'xField' => $data['config']['xField'] ?? 'player',
            'yField' => $data['config']['yField'] ?? 'goals',
            'groupBy' => $data['config']['groupBy'] ?? [],
            'metrics' => $data['config']['metrics'] ?? [],
            'filters' => $filters,
        ];
        if (!isset($fieldAliases[$config['xField']])) {
            $config['xField'] = array_key_first($fieldAliases);
        }
        if (!isset($fieldAliases[$config['yField']])) {
            $config['yField'] = array_key_first($fieldAliases);
        }
        if (!is_array($config['groupBy'])) {
            $config['groupBy'] = $config['groupBy'] ? [$config['groupBy']] : [];
        }
        // Validate metrics: allow alias keys or eventType:id tokens or eventCode:code tokens
        $validatedMetrics = [];
        $rawMetrics = $data['config']['metrics'] ?? null;
        if (!is_array($rawMetrics) && null !== $rawMetrics) {
            $rawMetrics = [$rawMetrics];
        }
        foreach ($rawMetrics as $m) {
            if (isset($fieldAliases[$m])) {
                $validatedMetrics[] = $m;
                continue;
            }
            if (is_string($m) && preg_match('/^eventType:\d+$/', $m)) {
                $validatedMetrics[] = $m;
                continue;
            }
            if (is_string($m) && preg_match('/^eventCode:.+$/', $m)) {
                $validatedMetrics[] = $m;
                continue;
            }
        }
        $config['metrics'] = $validatedMetrics;
        $report->setConfig($config);
        $report->setIsTemplate(false);
        $report->setUser($user);

        $reportData = $reportDataService->generateReportData($config);
        $previewHtml = $this->renderView('report/_preview_chart.html.twig', [
            'report' => $report,
            'labels' => $reportData['labels'],
            'datasets' => $reportData['datasets'],
            'diagramType' => $config['diagramType'],
        ]);

        return $this->json([
            'preview' => $previewHtml
        ]);
    }

    #[Route('/reports', name: 'app_report_list', methods: ['GET'])]
    public function list(EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        $repo = $em->getRepository(ReportDefinition::class);
        $templates = $repo->findBy(['isTemplate' => true]);
        $userReports = $repo->findBy(['user' => $user]);

        $templates = array_filter($templates, fn ($r) => $this->isGranted(ReportVoter::VIEW, $r));
        $userReports = array_filter($userReports, fn ($r) => $this->isGranted(ReportVoter::VIEW, $r));

        return $this->render('report/list.html.twig', [
            'templates' => $templates,
            'userReports' => $userReports
        ]);
    }

    #[Route('/reports/builder/{id}', name: 'app_report_builder', requirements: ['id' => '\\d+'], defaults: ['id' => null], methods: ['GET', 'POST'])]
    public function builder(Request $request, EntityManagerInterface $em, ?int $id = null): Response
    {
        /** @var User $user */
        $user = $this->getUser();
        $repo = $em->getRepository(ReportDefinition::class);
        $isEdit = null !== $id;
        $report = $isEdit ? $repo->find($id) : new ReportDefinition();
        $fieldAliases = ReportFieldAliasService::fieldAliases($em);
        if ($isEdit && (!$report || !$this->isGranted(ReportVoter::EDIT, $report))) {
            throw $this->createAccessDeniedException();
        }

        if ($request->isMethod('POST')) {
            $data = $request->request->all();
            $report->setName($data['name'] ?? '');
            $report->setDescription($data['description'] ?? null);
            $config = [
                'diagramType' => $data['config']['diagramType'] ?? 'bar',
                'xField' => $data['config']['xField'] ?? 'player',
                'yField' => $data['config']['yField'] ?? 'goals',
                'filters' => $data['config']['filters'] ?? [],
                'groupBy' => $data['config']['groupBy'] ?? [],
                'metrics' => $data['config']['metrics'] ?? [],
            ];

            // Nur erlaubte Aliase speichern
            if (!isset($fieldAliases[$config['xField']])) {
                $config['xField'] = array_key_first($fieldAliases);
            }
            if (!isset($fieldAliases[$config['yField']])) {
                $config['yField'] = array_key_first($fieldAliases);
            }
            // Validate metrics for server-side builder POST
            $validatedMetrics = [];
            $rawMetrics = $data['config']['metrics'] ?? null;
            if (!is_array($rawMetrics) && null !== $rawMetrics) {
                $rawMetrics = [$rawMetrics];
            }
            foreach ($rawMetrics as $m) {
                if (isset($fieldAliases[$m])) {
                    $validatedMetrics[] = $m;
                    continue;
                }
                if (is_string($m) && preg_match('/^eventType:\d+$/', $m)) {
                    $validatedMetrics[] = $m;
                    continue;
                }
                if (is_string($m) && preg_match('/^eventCode:.+$/', $m)) {
                    $validatedMetrics[] = $m;
                    continue;
                }
            }
            $config['metrics'] = $validatedMetrics;
            $report->setConfig($config);
            if ($this->isGranted('ROLE_SUPERADMIN') && isset($data['isTemplate'])) {
                $report->setIsTemplate(true);
                $report->setUser(null);
            } else {
                $report->setIsTemplate(false);
                $report->setUser($user);
            }

            $em->persist($report);
            $em->flush();

            return $this->redirectToRoute('app_report_list');
        }

        // Teams, Spieler, Ereignistypen für Filter
        $teamRepo = $em->getRepository(\App\Entity\Team::class);
        $playerRepo = $em->getRepository(\App\Entity\Player::class);
        $eventTypeRepo = $em->getRepository(\App\Entity\GameEventType::class);
        $gameEventRepo = $em->getRepository(\App\Entity\GameEvent::class);
        $teams = $teamRepo->findAll();
        $players = $playerRepo->findAll();
        $eventTypes = $eventTypeRepo->findAll();
        $dateRows = $gameEventRepo->createQueryBuilder('e')
            ->select('e.timestamp')
            ->orderBy('e.timestamp', 'ASC')
            ->getQuery()->getArrayResult();
        $availableDates = array_unique(array_map(
            fn ($row) => $row['timestamp']->format('Y-m-d'),
            $dateRows
        ));
        $availableDates = array_values($availableDates); // reindizieren
        $minDate = $availableDates[0] ?? null;
        $maxDate = $availableDates[count($availableDates) - 1] ?? null;

        return $this->render('report/builder.html.twig', [
            'report' => $report,
            'form_action' => $isEdit ? $this->generateUrl('app_report_builder', ['id' => $id]) : $this->generateUrl('app_report_builder'),
            'fieldAliases' => $fieldAliases,
            'teams' => $teams,
            'players' => $players,
            'eventTypes' => $eventTypes,
            'minDate' => $minDate,
            'maxDate' => $maxDate,
            'availableDates' => $availableDates,
        ]);
    }

    #[Route('/reports/delete/{id}', name: 'app_report_delete', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function delete(int $id, EntityManagerInterface $em): Response
    {
        $user = $this->getUser();
        $report = $em->getRepository(ReportDefinition::class)->find($id);
        if (!$report || !$this->isGranted(ReportVoter::DELETE, $report)) {
            throw $this->createNotFoundException('Report not found or access denied');
        }
        $em->remove($report);
        $em->flush();
        $this->addFlash('success', 'Report deleted.');

        return $this->redirectToRoute('app_report_list');
    }

    #[Route('/reports/add-widget/{id}', name: 'app_report_add_widget', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function addWidget(int $id, EntityManagerInterface $em): Response
    {
        /** @var User $user */
        $user = $this->getUser();
        $report = $em->getRepository(ReportDefinition::class)->find($id);
        if (!$report) {
            throw $this->createNotFoundException('Report not found');
        }
        $widget = new DashboardWidget();
        $widget->setUser($user);
        $widget->setType('report');
        $widget->setPosition(0); // Or calculate next position
        $widget->setWidth(6);
        $widget->setEnabled(true);
        $widget->setReportDefinition($report);
        $em->persist($widget);
        $em->flush();
        $this->addFlash('success', 'Report widget added to your dashboard.');

        return $this->redirectToRoute('app_dashboard_index');
    }
}
