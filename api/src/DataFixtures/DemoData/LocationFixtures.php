<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Location;
use App\Entity\SurfaceType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: 10 Sportanlagen für 10 Vereine im Raum Baden-Württemberg/Bayern.
 * Gruppe: demo.
 */
class LocationFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            \App\DataFixtures\MasterData\SurfaceTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        $existing = $manager->getRepository(Location::class)->findOneBy(['name' => 'Sonnenbergstadion']);
        if ($existing) {
            // Already loaded – re-register references and return
            $locations = $manager->getRepository(Location::class)->findAll();
            foreach ($locations as $loc) {
                foreach (self::LOCATIONS as $idx => $data) {
                    if ($data['name'] === $loc->getName()) {
                        $this->addReference('demo_location_' . $idx, $loc);
                    }
                }
            }

            return;
        }

        /** @var SurfaceType|null $naturrasen */
        $naturrasen = $manager->getRepository(SurfaceType::class)->findOneBy(['name' => 'Naturrasen']);
        /** @var SurfaceType|null $kunstrasen */
        $kunstrasen = $manager->getRepository(SurfaceType::class)->findOneBy(['name' => 'Kunstrasen']);
        /** @var SurfaceType|null $asche */
        $asche = $manager->getRepository(SurfaceType::class)->findOneBy(['name' => 'Asche']);

        foreach (self::LOCATIONS as $idx => $data) {
            $loc = new Location();
            $loc->setName($data['name']);
            $loc->setAddress($data['address']);
            $loc->setCity($data['city']);
            $loc->setCapacity($data['capacity']);
            $loc->setHasFloodlight($data['floodlight']);
            $surface = match ($data['surface']) {
                'Naturrasen' => $naturrasen,
                'Kunstrasen' => $kunstrasen,
                default => $asche,
            };
            $loc->setSurfaceType($surface);
            $loc->setLatitude($data['lat']);
            $loc->setLongitude($data['lng']);

            $manager->persist($loc);
            $this->addReference('demo_location_' . $idx, $loc);
        }

        $manager->flush();
    }

    private const LOCATIONS = [
        0 => [
            'name' => 'Sonnenbergstadion', 'address' => 'Sportplatzweg 1',
            'city' => 'Sonnenberg', 'capacity' => 2200, 'floodlight' => true,
            'surface' => 'Naturrasen', 'lat' => 48.512, 'lng' => 9.213,
        ],
        1 => [
            'name' => 'TSV-Sportpark Waldkirchen', 'address' => 'Waldstraße 18',
            'city' => 'Waldkirchen', 'capacity' => 1800, 'floodlight' => true,
            'surface' => 'Naturrasen', 'lat' => 48.634, 'lng' => 9.381,
        ],
        2 => [
            'name' => 'Bergheimer Sportgelände', 'address' => 'Am Sportplatz 3',
            'city' => 'Bergheim', 'capacity' => 1200, 'floodlight' => false,
            'surface' => 'Kunstrasen', 'lat' => 48.347, 'lng' => 9.051,
        ],
        3 => [
            'name' => 'SC-Platz Rosenbach', 'address' => 'Rosenbacher Weg 7',
            'city' => 'Rosenbach', 'capacity' => 1000, 'floodlight' => false,
            'surface' => 'Naturrasen', 'lat' => 48.455, 'lng' => 9.502,
        ],
        4 => [
            'name' => 'VfB-Sportanlage Mittelstadt', 'address' => 'Hauptstraße 45',
            'city' => 'Mittelstadt', 'capacity' => 1400, 'floodlight' => true,
            'surface' => 'Kunstrasen', 'lat' => 48.572, 'lng' => 9.672,
        ],
        5 => [
            'name' => 'FC-Platz Rotbach', 'address' => 'Rotbacher Sportweg 2',
            'city' => 'Rotbach', 'capacity' => 800, 'floodlight' => false,
            'surface' => 'Asche', 'lat' => 48.412, 'lng' => 9.134,
        ],
        6 => [
            'name' => 'TSG-Sportgelände Langental', 'address' => 'Langentalstraße 11',
            'city' => 'Langental', 'capacity' => 900, 'floodlight' => false,
            'surface' => 'Naturrasen', 'lat' => 48.288, 'lng' => 9.299,
        ],
        7 => [
            'name' => 'SpVgg-Anlage Grünhöhe', 'address' => 'Grünhöher Weg 5',
            'city' => 'Grünhöhe', 'capacity' => 750, 'floodlight' => false,
            'surface' => 'Asche', 'lat' => 48.321, 'lng' => 9.588,
        ],
        8 => [
            'name' => 'Birkenauer Sportplatz', 'address' => 'Am Birkenbach 9',
            'city' => 'Birkenau', 'capacity' => 600, 'floodlight' => false,
            'surface' => 'Naturrasen', 'lat' => 48.198, 'lng' => 9.421,
        ],
        9 => [
            'name' => 'Weissacher Sportpark', 'address' => 'Sportparkstraße 3',
            'city' => 'Weissach', 'capacity' => 700, 'floodlight' => false,
            'surface' => 'Kunstrasen', 'lat' => 48.243, 'lng' => 9.150,
        ],
    ];
}
