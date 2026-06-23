<?php

namespace App\DataFixtures\MasterData;

use App\Entity\FunctionaryClubAssignmentType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class FunctionaryClubAssignmentTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            ['name' => 'Vereinspräsident', 'description' => 'Höchstes Amt im Verein.', 'active' => true],
            ['name' => 'Vizepräsident', 'description' => 'Stellvertretung des Präsidenten.', 'active' => true],
            ['name' => 'Sportwart', 'description' => 'Zuständig für sportliche Angelegenheiten im Verein.', 'active' => true],
            ['name' => 'Schriftführer', 'description' => 'Protokollführung und Vereinsdokumentation.', 'active' => true],
            ['name' => 'Beisitzer', 'description' => 'Mitglied des Vorstands ohne spezifisches Ressort.', 'active' => true],
            ['name' => 'Kassenwart', 'description' => 'Verwaltung der finanziellen Angelegenheiten des Vereins.', 'active' => true],
        ];

        foreach ($types as $type) {
            $assignmentType = $manager->getRepository(FunctionaryClubAssignmentType::class)
                ->findOneBy(['name' => $type['name']]) ?? new FunctionaryClubAssignmentType();

            $assignmentType->setName($type['name']);
            $assignmentType->setDescription($type['description']);
            $assignmentType->setActive($type['active']);
            $manager->persist($assignmentType);
        }

        $manager->flush();
    }
}
