<?php

namespace App\DataFixtures\MasterData;

use App\Entity\StaffTeamAssignmentType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class StaffTeamAssignmentTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            ['name' => 'Physiotherapeut', 'description' => 'Medizinische Betreuung und Rehabilitation der Spieler.', 'active' => true],
            ['name' => 'Teammanager', 'description' => 'Organisatorische Leitung des Teams.', 'active' => true],
            ['name' => 'Zeugwart', 'description' => 'Verantwortlich für Ausrüstung und Material.', 'active' => true],
            ['name' => 'Busfahrer', 'description' => 'Transport des Teams zu Auswärtsspielen.', 'active' => true],
            ['name' => 'Medienbeauftragter', 'description' => 'Betreuung von Social Media und Pressearbeit.', 'active' => true],
        ];

        foreach ($types as $type) {
            $assignmentType = $manager->getRepository(StaffTeamAssignmentType::class)
                ->findOneBy(['name' => $type['name']]) ?? new StaffTeamAssignmentType();

            $assignmentType->setName($type['name']);
            $assignmentType->setDescription($type['description']);
            $assignmentType->setActive($type['active']);
            $manager->persist($assignmentType);
        }

        $manager->flush();
    }
}
