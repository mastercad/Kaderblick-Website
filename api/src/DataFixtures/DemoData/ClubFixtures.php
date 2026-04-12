<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Club;
use App\Entity\Location;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: 10 Vereine im Raum Baden-Württemberg/Bayern.
 * Gruppe: demo.
 *
 * Verein-Index → Vereinsgröße:
 *   0 FC Sonnenberg       groß  (9 Teams)
 *   1 TSV Waldkirchen     groß  (7 Teams)
 *   2 SV Bergheim         mittel(5 Teams)
 *   3 SC Rosenbach        mittel(5 Teams)
 *   4 VfB Mittelstadt     mittel(5 Teams)
 *   5 FC Rotbach          klein (4 Teams)
 *   6 TSG Langental       klein (4 Teams)
 *   7 SpVgg Grünhöhe      klein (4 Teams)
 *   8 FV Birkenau         klein (3 Teams)
 *   9 SV Eintracht Weissach klein(3 Teams)
 */
class ClubFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            LocationFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        $existing = $manager->getRepository(Club::class)->findOneBy(['name' => 'FC Sonnenberg 1925 e.V.']);
        if ($existing) {
            foreach (self::CLUBS as $idx => $data) {
                $club = $manager->getRepository(Club::class)->findOneBy(['name' => $data['name']]);
                if ($club) {
                    $this->addReference('demo_club_' . $idx, $club);
                }
            }

            return;
        }

        foreach (self::CLUBS as $idx => $data) {
            /** @var Location $location */
            $location = $this->getReference('demo_location_' . $idx, Location::class);

            $club = new Club();
            $club->setName($data['name']);
            $club->setShortName($data['shortName']);
            $club->setAbbreviation($data['abbr']);
            $club->setStadiumName($data['stadium']);
            $club->setFoundingYear($data['founded']);
            $club->setWebsite($data['website']);
            $club->setEmail($data['email']);
            $club->setPhone($data['phone']);
            $club->setClubColors($data['colors']);
            $club->setActive(true);
            $club->setLocation($location);

            $manager->persist($club);
            $this->addReference('demo_club_' . $idx, $club);
        }

        $manager->flush();
    }

    private const CLUBS = [
        0 => [
            'name' => 'FC Sonnenberg 1925 e.V.',
            'shortName' => 'FC Sonnenberg',
            'abbr' => 'FCS',
            'stadium' => 'Sonnenbergstadion',
            'founded' => 1925,
            'website' => 'https://fc-sonnenberg.de',
            'email' => 'info@fc-sonnenberg.de',
            'phone' => '+49 7123 45678',
            'colors' => 'Blau-Weiß',
        ],
        1 => [
            'name' => 'TSV Waldkirchen 1932 e.V.',
            'shortName' => 'TSV Waldkirchen',
            'abbr' => 'TSVW',
            'stadium' => 'TSV-Sportpark Waldkirchen',
            'founded' => 1932,
            'website' => 'https://tsv-waldkirchen.de',
            'email' => 'info@tsv-waldkirchen.de',
            'phone' => '+49 7124 56789',
            'colors' => 'Grün-Weiß',
        ],
        2 => [
            'name' => 'SV Bergheim 1948 e.V.',
            'shortName' => 'SV Bergheim',
            'abbr' => 'SVB',
            'stadium' => 'Bergheimer Sportgelände',
            'founded' => 1948,
            'website' => 'https://sv-bergheim.de',
            'email' => 'info@sv-bergheim.de',
            'phone' => '+49 7125 67890',
            'colors' => 'Schwarz-Gelb',
        ],
        3 => [
            'name' => 'SC Blau-Weiß Rosenbach e.V.',
            'shortName' => 'SC Rosenbach',
            'abbr' => 'SCR',
            'stadium' => 'SC-Platz Rosenbach',
            'founded' => 1951,
            'website' => 'https://sc-rosenbach.de',
            'email' => 'info@sc-rosenbach.de',
            'phone' => '+49 7126 78901',
            'colors' => 'Blau-Weiß',
        ],
        4 => [
            'name' => 'VfB Mittelstadt 1955 e.V.',
            'shortName' => 'VfB Mittelstadt',
            'abbr' => 'VfBM',
            'stadium' => 'VfB-Sportanlage Mittelstadt',
            'founded' => 1955,
            'website' => 'https://vfb-mittelstadt.de',
            'email' => 'info@vfb-mittelstadt.de',
            'phone' => '+49 7127 89012',
            'colors' => 'Rot-Weiß',
        ],
        5 => [
            'name' => 'FC Rotbach 1967 e.V.',
            'shortName' => 'FC Rotbach',
            'abbr' => 'FCR',
            'stadium' => 'FC-Platz Rotbach',
            'founded' => 1967,
            'website' => 'https://fc-rotbach.de',
            'email' => 'info@fc-rotbach.de',
            'phone' => '+49 7128 90123',
            'colors' => 'Orange-Schwarz',
        ],
        6 => [
            'name' => 'TSG Langental 1971 e.V.',
            'shortName' => 'TSG Langental',
            'abbr' => 'TSGL',
            'stadium' => 'TSG-Sportgelände Langental',
            'founded' => 1971,
            'website' => 'https://tsg-langental.de',
            'email' => 'info@tsg-langental.de',
            'phone' => '+49 7129 01234',
            'colors' => 'Gelb-Blau',
        ],
        7 => [
            'name' => 'SpVgg Grünhöhe 1958 e.V.',
            'shortName' => 'SpVgg Grünhöhe',
            'abbr' => 'SpVggG',
            'stadium' => 'SpVgg-Anlage Grünhöhe',
            'founded' => 1958,
            'website' => 'https://spvgg-gruenhoehe.de',
            'email' => 'info@spvgg-gruenhoehe.de',
            'phone' => '+49 7130 12345',
            'colors' => 'Grün-Weiß',
        ],
        8 => [
            'name' => 'FV Birkenau 1963 e.V.',
            'shortName' => 'FV Birkenau',
            'abbr' => 'FVB',
            'stadium' => 'Birkenauer Sportplatz',
            'founded' => 1963,
            'website' => 'https://fv-birkenau.de',
            'email' => 'info@fv-birkenau.de',
            'phone' => '+49 7131 23456',
            'colors' => 'Rot-Schwarz',
        ],
        9 => [
            'name' => 'SV Eintracht Weissach 1978 e.V.',
            'shortName' => 'SV Weissach',
            'abbr' => 'SVW',
            'stadium' => 'Weissacher Sportpark',
            'founded' => 1978,
            'website' => 'https://sv-weissach.de',
            'email' => 'info@sv-weissach.de',
            'phone' => '+49 7132 34567',
            'colors' => 'Weiß-Blau',
        ],
    ];
}
