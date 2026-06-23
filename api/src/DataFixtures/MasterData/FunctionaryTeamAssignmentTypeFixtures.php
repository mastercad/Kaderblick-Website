<?php

namespace App\DataFixtures\MasterData;

use App\Entity\FunctionaryTeamAssignmentType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class FunctionaryTeamAssignmentTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            ['name' => 'Mannschaftskapitän', 'description' => 'Führungsperson und Repräsentant der Mannschaft.', 'active' => true],
            ['name' => 'Spielführer', 'description' => 'Verantwortlicher Ansprechpartner auf dem Spielfeld.', 'active' => true],
            ['name' => 'Jugendwart', 'description' => 'Betreuung und Organisation der Jugendmannschaft.', 'active' => true],
            ['name' => 'Elternbeirat', 'description' => 'Vertretung der Elterninteressen im Team.', 'active' => true],
            ['name' => 'Kassenwart', 'description' => 'Verwaltung der finanziellen Angelegenheiten der Mannschaft.', 'active' => true],
        ];

        foreach ($types as $type) {
            $assignmentType = $manager->getRepository(FunctionaryTeamAssignmentType::class)
                ->findOneBy(['name' => $type['name']]) ?? new FunctionaryTeamAssignmentType();

            $assignmentType->setName($type['name']);
            $assignmentType->setDescription($type['description']);
            $assignmentType->setActive($type['active']);
            $manager->persist($assignmentType);
        }

        $manager->flush();
    }
}
