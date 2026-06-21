<?php

namespace App\Controller\Api;

use App\Entity\DashboardWidget;
use App\Entity\ReportDefinition;
use App\Entity\User;
use App\Security\Voter\ReportVoter;
use App\Security\Voter\WidgetVoter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/widget')]
#[IsGranted('ROLE_USER')]
class WidgetController extends AbstractController
{
    #[Route('', name: 'api_widget_create', methods: ['POST'])]
    public function add(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        if (!is_array($data)) {
            return $this->json(['error' => 'Invalid JSON body'], 400);
        }

        $type = strtolower(trim((string) ($data['type'] ?? '')));

        if ('' === $type) {
            return $this->json(['error' => 'Widget type is required'], 400);
        }

        /** @var User $user */
        $user = $this->getUser();
        $report = null;

        if ('report' === $type) {
            $reportId = filter_var($data['reportId'] ?? null, FILTER_VALIDATE_INT);
            if (false === $reportId || $reportId < 1) {
                return $this->json(['error' => 'Report ID is required'], 400);
            }

            $report = $em->getRepository(ReportDefinition::class)->find($reportId);
            if (!$report instanceof ReportDefinition) {
                return $this->json(['error' => 'Report not found'], 404);
            }

            if (!$this->isGranted(ReportVoter::VIEW, $report)) {
                return $this->json(['error' => 'Zugriff verweigert'], 403);
            }
        }

        $defaultConfig = match ($type) {
            'upcoming_events' => ['limit' => 5],
            default => [],
        };
        $config = $data['config'] ?? $defaultConfig;
        if (!is_array($config)) {
            return $this->json(['error' => 'Widget config must be an object'], 400);
        }

        $widget = new DashboardWidget();
        $widget->setUser($user);
        $widget->setType($type);
        $widget->setPosition(isset($data['position']) ? max(0, (int) $data['position']) : count($user->getWidgets()));
        if (isset($data['width'])) {
            $widget->setWidth(max(1, min(12, (int) $data['width'])));
        }
        $widget->setConfig($config);
        $widget->setEnabled(true);
        $widget->setDefault(false);
        $widget->setReportDefinition($report);

        $em->persist($widget);
        $em->flush();

        return $this->json(['widget' => [
            'id' => $widget->getId(),
            'type' => $widget->getType(),
<<<<<<< HEAD
            'name' => $report?->getName(),
            'description' => $report?->getDescription(),
            'width' => $widget->getWidth(),
            'position' => $widget->getPosition(),
            'config' => $widget->getConfig(),
            'default' => $widget->isDefault(),
            'enabled' => $widget->isEnabled(),
            'reportId' => $report?->getId(),
=======
            'name' => null,
            'width' => $widget->getWidth(),
            'position' => $widget->getPosition(),
            'config' => $widget->getConfig(),
            'isDefault' => $widget->isDefault(),
            'isEnabled' => $widget->isEnabled(),
            'reportId' => null,
>>>>>>> origin/main
        ]]);
    }

    #[Route('/{id}', name: 'api_widget_remove', methods: ['DELETE'])]
    public function remove(
        DashboardWidget $widget,
        EntityManagerInterface $em
    ): JsonResponse {
        if (!$this->isGranted(WidgetVoter::DELETE, $widget)) {
            return $this->json(['error' => 'Zugriff verweigert'], 403);
        }

        $em->remove($widget);
        $em->flush();

        return $this->json(['status' => 'success']);
    }
}
