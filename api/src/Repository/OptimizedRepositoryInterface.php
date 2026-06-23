<?php

namespace App\Repository;

use Symfony\Component\Security\Core\User\UserInterface;

/**
 * @template T of object
 */
interface OptimizedRepositoryInterface
{
    /**
     * Lädt eine vollständige Liste mit allen Relationen (für Admin-Bereiche).
     *
     * @return array<int, T>
     */
    public function fetchFullList(?UserInterface $user = null): array;

    /**
     * Lädt eine optimierte Liste mit minimal benötigten Feldern (für Frontend/API).
     *
     * @return array<int, T>
     */
    public function fetchOptimizedList(?UserInterface $user = null): array;

    /**
     * Lädt einen einzelnen Eintrag mit allen Relationen (für Admin-Detailansicht).
     *
     * @return array<string, mixed>|T|null
     */
    public function fetchFullEntry(int $id, ?UserInterface $user = null): array | object | null;

    /**
     * Lädt einen einzelnen Eintrag mit minimal benötigten Feldern (für Frontend/API).
     *
     * @return array<string, mixed>|T|null
     */
    public function fetchOptimizedEntry(int $id, ?UserInterface $user = null): array | object | null;
}
