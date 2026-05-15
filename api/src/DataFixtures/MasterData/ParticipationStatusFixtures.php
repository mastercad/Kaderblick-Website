<?php

namespace App\DataFixtures\MasterData;

use App\Entity\ParticipationStatus;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class ParticipationStatusFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $statuses = [
            [
                'name' => 'Zugesagt',
                'code' => 'attending',
                'color' => '#28a745',
                'icon' => 'check-circle',
                'sortOrder' => 10
            ],
            [
                'name' => 'Vielleicht',
                'code' => 'maybe',
                'color' => '#ffc107',
                'icon' => 'question-circle',
                'sortOrder' => 20
            ],
            [
                'name' => 'Abgesagt',
                'code' => 'not_attending',
                'color' => '#dc3545',
                'icon' => 'times-circle',
                'sortOrder' => 30
            ],
            [
                'name' => 'Verspätet',
                'code' => 'late',
                'color' => '#fd7e14',
                'icon' => 'clock',
                'sortOrder' => 40
            ],
            [
                'name' => 'Gesperrt',
                'code' => 'suspended',
                'color' => '#f44336',
                'icon' => 'block',
                'sortOrder' => 90
            ],
        ];

        foreach ($statuses as $statusData) {
            $existing = $manager->getRepository(ParticipationStatus::class)->findOneBy([
                'code' => $statusData['code'],
            ]);
            if ($existing) {
                $status = $existing;
            } else {
                $status = new ParticipationStatus();
                $status->setName($statusData['name']);
                $status->setCode($statusData['code']);
                $status->setColor($statusData['color']);
                $status->setIcon($statusData['icon']);
                $status->setSortOrder($statusData['sortOrder']);
                $status->setIsActive(true);
                $manager->persist($status);
            }

            // Create reference for other fixtures
            $this->addReference('participation-status-' . $statusData['code'], $status);
        }

        $manager->flush();
    }
}
