<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\Location;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: 30 Sportstätten in verschiedenen deutschen Städten.
 * Gruppe: load_test.
 */
class LocationFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function load(ObjectManager $manager): void
    {
        $locations = [
            ['name' => 'Sportanlage Nord München', 'address' => 'Schleißheimer Str. 100', 'city' => 'München', 'lat' => 48.1751, 'lng' => 11.5567, 'capacity' => 12000],
            ['name' => 'Sportpark Ost Dortmund', 'address' => 'Strobelallee 50', 'city' => 'Dortmund', 'lat' => 51.4950, 'lng' => 7.4518, 'capacity' => 8000],
            ['name' => 'Stadion Bayer-Wiesen Leverkusen', 'address' => 'Bismarckstr. 122-130', 'city' => 'Leverkusen', 'lat' => 51.0382, 'lng' => 7.0023, 'capacity' => 7500],
            ['name' => 'Sportgelände Sachsendorf Leipzig', 'address' => 'Am Sachsenring 22', 'city' => 'Leipzig', 'lat' => 51.3397, 'lng' => 12.3731, 'capacity' => 6000],
            [
                'name' => 'Sportpark Niederrhein Mönchengladbach', 'address' => 'Nordparkstr. 400',
                'city' => 'Mönchengladbach', 'lat' => 51.2012, 'lng' => 6.4315, 'capacity' => 5500,
            ],
            [
                'name' => 'Vereinsgelände Bornheim Frankfurt', 'address' => 'Hans-Böckler-Str. 13',
                'city' => 'Frankfurt am Main', 'lat' => 50.1219, 'lng' => 8.6823, 'capacity' => 6200,
            ],
            ['name' => 'Dreisamstadion Freiburg', 'address' => 'Schwarzwaldstr. 193', 'city' => 'Freiburg im Breisgau', 'lat' => 47.9856, 'lng' => 7.8299, 'capacity' => 4800],
            ['name' => 'Sportzentrum Kraichgau Hoffenheim', 'address' => 'Dietmar-Hopp-Str. 5', 'city' => 'Sinsheim', 'lat' => 49.2382, 'lng' => 8.8898, 'capacity' => 5000],
            ['name' => 'VfL Sportplatz Wolfsburg', 'address' => 'Werner-Nienaber-Str. 4', 'city' => 'Wolfsburg', 'lat' => 52.4227, 'lng' => 10.7866, 'capacity' => 5700],
            ['name' => 'Sportzentrum Augsburger Süden', 'address' => 'Haunstetter Str. 200', 'city' => 'Augsburg', 'lat' => 48.3295, 'lng' => 10.9116, 'capacity' => 4200],
            ['name' => 'Sportpark Cannstatt Stuttgart', 'address' => 'Mercedesstr. 87', 'city' => 'Stuttgart', 'lat' => 48.7943, 'lng' => 9.2317, 'capacity' => 6800],
            [
                'name' => 'Stadion an der Alten Försterei Berlin', 'address' => 'An der Alten Försterei 2',
                'city' => 'Berlin', 'lat' => 52.4575, 'lng' => 13.5662, 'capacity' => 7500,
            ],
            ['name' => 'Sportanlage Weserstadion Bremen', 'address' => 'Franz-Böhmert-Str. 1c', 'city' => 'Bremen', 'lat' => 53.0666, 'lng' => 8.8376, 'capacity' => 5900],
            ['name' => 'Volkspark Sportanlage Hamburg', 'address' => 'Sylvesterallee 7', 'city' => 'Hamburg', 'lat' => 53.5872, 'lng' => 9.8983, 'capacity' => 9000],
            ['name' => 'Vereinssportanlage Buer Gelsenkirchen', 'address' => 'Parkallee 55', 'city' => 'Gelsenkirchen', 'lat' => 51.5675, 'lng' => 7.0678, 'capacity' => 4600],
            ['name' => 'SportCenter Deutz Köln', 'address' => 'Aachener Str. 999', 'city' => 'Köln', 'lat' => 50.9333, 'lng' => 6.9583, 'capacity' => 5100],
            ['name' => 'Sportplatz Calenberger Neustadt Hannover', 'address' => 'Arthur-Menge-Ufer 5', 'city' => 'Hannover', 'lat' => 52.3739, 'lng' => 9.7381, 'capacity' => 4300],
            ['name' => 'Sportanlage Zabo Nürnberg', 'address' => 'Zerzabelshofstr. 25', 'city' => 'Nürnberg', 'lat' => 49.4568, 'lng' => 11.1127, 'capacity' => 4000],
            ['name' => 'Sportpark Hanseviertel Rostock', 'address' => 'Hammer Str. 7', 'city' => 'Rostock', 'lat' => 54.0836, 'lng' => 12.1350, 'capacity' => 3500],
            ['name' => 'Sportzentrum Ronhof Fürth', 'address' => 'Laubenweg 600', 'city' => 'Fürth', 'lat' => 49.4780, 'lng' => 10.9923, 'capacity' => 4200],
            [
                'name' => 'Sportanlage Hardtwaldstadion Sandhausen', 'address' => 'Untergrombacher Str. 2',
                'city' => 'Sandhausen', 'lat' => 49.3473, 'lng' => 8.6564, 'capacity' => 3200,
            ],
            [
                'name' => 'Vereinssportgelände Unterhaching', 'address' => 'Heinrich-Wieland-Str. 35',
                'city' => 'Unterhaching', 'lat' => 48.0666, 'lng' => 11.6166, 'capacity' => 2500,
            ],
            ['name' => 'Sportplatz Grotenburg Krefeld', 'address' => 'Grotenburg 40', 'city' => 'Krefeld', 'lat' => 51.3345, 'lng' => 6.5793, 'capacity' => 3100],
            ['name' => 'Sportanlage Erzgebirgsstadion Aue', 'address' => 'Fichtelbergstr. 83', 'city' => 'Aue', 'lat' => 50.5898, 'lng' => 12.7032, 'capacity' => 3800],
            [
                'name' => 'Sportgelände Neapelstadion München Giesing', 'address' => 'Grünwalder Str. 114',
                'city' => 'München', 'lat' => 48.1066, 'lng' => 11.5766, 'capacity' => 4200,
            ],
            ['name' => 'Trainingszentrum FC Bayern Säbener Str.', 'address' => 'Säbener Str. 51', 'city' => 'München', 'lat' => 48.0833, 'lng' => 11.5666, 'capacity' => 2000],
            ['name' => 'BVB Trainingszentrum Brackel', 'address' => 'Strobelallee 50', 'city' => 'Dortmund', 'lat' => 51.5195, 'lng' => 7.5198, 'capacity' => 1500],
            ['name' => 'Sportanlage Volkspark Nord Hamburg', 'address' => 'Stellinger Damm 56', 'city' => 'Hamburg', 'lat' => 53.5930, 'lng' => 9.8783, 'capacity' => 2800],
            ['name' => 'Sportpark Wörthstr. Frankfurt', 'address' => 'Wörthstr. 2', 'city' => 'Frankfurt am Main', 'lat' => 50.1044, 'lng' => 8.6934, 'capacity' => 1800],
            ['name' => 'Gemeindestadion Türkheim', 'address' => 'Sportplatzweg 8', 'city' => 'Türkheim', 'lat' => 48.0619, 'lng' => 10.6347, 'capacity' => 1200],
        ];

        foreach ($locations as $i => $data) {
            $existing = $manager->getRepository(Location::class)->findOneBy(['name' => $data['name']]);
            if ($existing) {
                $this->addReference('lt_location_' . $i, $existing);
                continue;
            }

            $location = new Location();
            $location->setName($data['name']);
            $location->setAddress($data['address']);
            $location->setCity($data['city']);
            $location->setLatitude($data['lat']);
            $location->setLongitude($data['lng']);
            $location->setCapacity($data['capacity']);
            $manager->persist($location);
            $this->addReference('lt_location_' . $i, $location);
        }

        $manager->flush();
    }
}
