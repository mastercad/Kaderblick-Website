<?php

namespace App\DataFixtures\MasterData;

use App\Entity\RelationType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class RelationTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            // Player Relations
            ['parent', 'Elternteil', 'player'],
            ['sibling', 'Geschwister', 'player'],
            ['relative', 'Verwandter', 'player'],
            ['guardian', 'Erziehungsberechtigter', 'player'],
            ['friend', 'Freund', 'player'],
            ['self_player', 'Spieler selbst', 'player'],

            // Coach Relations
            ['assistant', 'Assistent', 'coach'],
            ['observer', 'Beobachter', 'coach'],
            ['substitute', 'Vertretung', 'coach'],
            ['mentor', 'Mentor', 'coach'],
            ['self_coach', 'Trainer selbst', 'coach'],

            // Functionary Relations
            ['self_functionary', 'Funktionär selbst', 'functionary'],
            ['representative', 'Vertreter', 'functionary'],

            // Staff Relations
            ['self_staff', 'Mitarbeiter selbst', 'staff'],
            ['colleague', 'Kollege', 'staff'],
        ];

        foreach ($types as [$identifier, $name, $category]) {
            $existing = $manager->getRepository(RelationType::class)->findOneBy([
                'identifier' => $identifier,
                'category' => $category,
            ]);
            if ($existing) {
                $type = $existing;
            } else {
                $type = new RelationType();
                $type->setIdentifier($identifier);
                $type->setName($name);
                $type->setCategory($category);
                $manager->persist($type);
            }

            $this->addReference('relation_type_' . $identifier, $type);
        }

        $manager->flush();
    }
}
