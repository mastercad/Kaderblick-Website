<?php

namespace App\Controller\Admin;

use App\Service\SystemSettingService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/superadmin/system-settings')]
#[IsGranted('ROLE_SUPERADMIN')]
class SystemSettingController extends AbstractController
{
    public function __construct(
        private SystemSettingService $settingService,
    ) {
    }

    /**
     * GET /api/superadmin/system-settings
     * Returns all system settings as a key-value map.
     */
    #[Route('', name: 'api_superadmin_system_settings_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->json([
            'settings' => $this->settingService->getAll(),
            'defaults' => [
                SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED => 'true',
                SystemSettingService::KEY_2FA_REQUIRED => 'false',
            ],
        ]);
    }

    /**
     * PATCH /api/superadmin/system-settings/{key}
     * Set a single setting value. Body: { "value": "true" }.
     *
     * Accepts "true"/"false" strings or any other plain string value.
     */
    #[Route('/{key}', name: 'api_superadmin_system_settings_update', methods: ['PATCH'])]
    public function update(string $key, Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['value'])) {
            return $this->json(['error' => 'Missing "value" field.'], 400);
        }

        $allowedKeys = [
            SystemSettingService::KEY_REGISTRATION_CONTEXT_ENABLED,
            SystemSettingService::KEY_2FA_REQUIRED,
        ];

        if (!in_array($key, $allowedKeys, true)) {
            return $this->json(['error' => sprintf('Unknown setting key "%s".', $key)], 400);
        }

        $this->settingService->set($key, (string) $data['value']);

        return $this->json([
            'key' => $key,
            'value' => $data['value'],
        ]);
    }
}
