<?php

namespace App\DataFixtures\MasterData;

use App\Entity\StaffClubAssignmentType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class StaffClubAssignmentTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            ['name' => 'Vereinsarzt', 'description' => 'Medizinische Betreuung des gesamten Vereins.', 'active' => true],
            ['name' => 'Geschäftsführer', 'description' => 'Operative Leitung des Vereins.', 'active' => true],
            ['name' => 'Platzwart', 'description' => 'Pflege und Wartung der Vereinsanlagen.', 'active' => true],
            ['name' => 'Pressesprecher', 'description' => 'Öffentlichkeitsarbeit und Kommunikation.', 'active' => true],
        ];

        foreach ($types as $type) {
            $assignmentType = $manager->getRepository(StaffClubAssignmentType::class)
                ->findOneBy(['name' => $type['name']]) ?? new StaffClubAssignmentType();

            $assignmentType->setName($type['name']);
            $assignmentType->setDescription($type['description']);
            $assignmentType->setActive($type['active']);
            $manager->persist($assignmentType);
        }

        $manager->flush();
    }
}
