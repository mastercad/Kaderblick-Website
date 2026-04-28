<?php

namespace App\DataFixtures\MasterData;

use App\Entity\FormationType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class FormationTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $formationTypes = [
            [
                'name' => 'fußball',
                'background' => 'fussballfeld_haelfte.jpg',
                'cssClass' => 'field-football'
            ],
            [
                'name' => 'handball',
                'background' => '',
                'cssClass' => 'field-handball'
            ],
            [
                'name' => 'basketball',
                'background' => '',
                'cssClass' => 'field-basketball'
            ],
            [
                'name' => 'volleyball',
                'background' => 'volleyball_haelfte.jpg',
                'cssClass' => 'field-volleyball'
            ],
            [
                'name' => 'eishockey',
                'background' => '',
                'cssClass' => 'field-eishockey'
            ],
            [
                'name' => 'american football',
                'background' => '',
                'cssClass' => 'field-american-football'
            ],
            [
                'name' => 'tennis',
                'background' => '',
                'cssClass' => 'field-tennis'
            ],
            [
                'name' => 'rugby',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'lacrosse',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'cricket',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'hockey',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'futsal',
                'background' => '',
                'cssClass' => 'field-football'
            ],
            [
                'name' => 'tischtennis',
                'background' => '',
                'cssClass' => 'field-tennis'
            ],
            [
                'name' => 'badminton',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'baseball',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'softball',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'waterpolo',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'korfball',
                'background' => '',
                'cssClass' => 'field-basketball'
            ],
            [
                'name' => 'ultimate frisbee',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'floorball',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'netball',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'aussie rules',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'gaelic football',
                'background' => '',
                'cssClass' => 'field-football'
            ],
            [
                'name' => 'hurling',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'bandy',
                'background' => '',
                'cssClass' => 'field-eishockey'
            ],
            [
                'name' => 'field hockey',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'golf',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'e-sport',
                'background' => '',
                'cssClass' => 'field-default'
            ],
            [
                'name' => 'andere',
                'background' => '',
                'cssClass' => 'field-andere'
            ]
        ];

        foreach ($formationTypes as $formationType) {
            $existing = $manager->getRepository(FormationType::class)
                ->findOneBy(['name' => $formationType['name']]);
            if (!$existing) {
                $formation = new FormationType();
                $formation->setName($formationType['name']);
                $formation->setBackgroundPath($formationType['background']);
                $formation->setCssClass($formationType['cssClass']);
                $manager->persist($formation);
                $this->addReference('formation_type_' . strtolower($formationType['name']), $formation);
            }
        }

        $manager->flush();
    }
}
