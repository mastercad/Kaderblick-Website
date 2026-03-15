<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\Club;
use App\Entity\Location;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: 25 deutsche Fußballvereine verschiedener Größen und Ligen.
 * Einige kleine Klubs teilen sich später Mannschaften (Spielgemeinschaften).
 * Gruppe: load_test.
 */
class ClubFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [LocationFixtures::class];
    }

    public function load(ObjectManager $manager): void
    {
        // Index 0-7: Große Klubs (6 Teams je)
        // Index 8-15: Mittlere Klubs (4 Teams je)
        // Index 16-24: Kleine Klubs (2 Teams je)
        $clubs = [
            // Große Klubs 0-7
            [
                'name' => 'FC Bayern München',
                'shortName' => 'FC Bayern',
                'abbreviation' => 'FCB',
                'stadiumName' => 'Allianz Arena',
                'foundingYear' => 1900,
                'website' => 'https://fcbayern.com',
                'email' => 'info@fcbayern.com',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 0,
            ],
            [
                'name' => 'Borussia Dortmund',
                'shortName' => 'BVB',
                'abbreviation' => 'BVB',
                'stadiumName' => 'Signal Iduna Park',
                'foundingYear' => 1909,
                'website' => 'https://bvb.de',
                'email' => 'info@bvb.de',
                'clubColors' => 'Schwarz/Gelb',
                'locationIdx' => 1,
            ],
            [
                'name' => 'Bayer 04 Leverkusen',
                'shortName' => 'Bayer Leverkusen',
                'abbreviation' => 'B04',
                'stadiumName' => 'BayArena',
                'foundingYear' => 1904,
                'website' => 'https://bayer04.de',
                'email' => 'info@bayer04.de',
                'clubColors' => 'Schwarz/Rot',
                'locationIdx' => 2,
            ],
            [
                'name' => 'RB Leipzig',
                'shortName' => 'RB Leipzig',
                'abbreviation' => 'RBL',
                'stadiumName' => 'Red Bull Arena',
                'foundingYear' => 2009,
                'website' => 'https://rbleipzig.com',
                'email' => 'info@rbleipzig.com',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 3,
            ],
            [
                'name' => 'Borussia Mönchengladbach',
                'shortName' => 'Gladbach',
                'abbreviation' => 'BMG',
                'stadiumName' => 'Borussia-Park',
                'foundingYear' => 1900,
                'website' => 'https://borussia.de',
                'email' => 'info@borussia.de',
                'clubColors' => 'Schwarz/Weiß/Grün',
                'locationIdx' => 4,
            ],
            [
                'name' => 'Eintracht Frankfurt',
                'shortName' => 'Eintracht',
                'abbreviation' => 'SGE',
                'stadiumName' => 'Deutsche Bank Park',
                'foundingYear' => 1899,
                'website' => 'https://eintracht.de',
                'email' => 'info@eintracht.de',
                'clubColors' => 'Schwarz/Weiß/Rot',
                'locationIdx' => 5,
            ],
            [
                'name' => 'SC Freiburg',
                'shortName' => 'SC Freiburg',
                'abbreviation' => 'SCF',
                'stadiumName' => 'Europa-Park Stadion',
                'foundingYear' => 1904,
                'website' => 'https://scfreiburg.com',
                'email' => 'info@scfreiburg.com',
                'clubColors' => 'Schwarz/Rot',
                'locationIdx' => 6,
            ],
            [
                'name' => 'TSG 1899 Hoffenheim',
                'shortName' => 'Hoffenheim',
                'abbreviation' => 'TSG',
                'stadiumName' => 'PreZero Arena',
                'foundingYear' => 1899,
                'website' => 'https://achtzehn99.de',
                'email' => 'info@tsg-hoffenheim.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 7,
            ],
            // Mittlere Klubs 8-15
            [
                'name' => 'VfL Wolfsburg',
                'shortName' => 'Wolfsburg',
                'abbreviation' => 'VFL',
                'stadiumName' => 'Volkswagen Arena',
                'foundingYear' => 1945,
                'website' => 'https://vfl-wolfsburg.de',
                'email' => 'info@vfl-wolfsburg.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 8,
            ],
            [
                'name' => 'FC Augsburg',
                'shortName' => 'FC Augsburg',
                'abbreviation' => 'FCA',
                'stadiumName' => 'WWK Arena',
                'foundingYear' => 1907,
                'website' => 'https://fcaugsburg.de',
                'email' => 'info@fcaugsburg.de',
                'clubColors' => 'Rot/Grün/Weiß',
                'locationIdx' => 9,
            ],
            [
                'name' => 'VfB Stuttgart',
                'shortName' => 'VfB Stuttgart',
                'abbreviation' => 'VFB',
                'stadiumName' => 'MHPArena',
                'foundingYear' => 1893,
                'website' => 'https://vfb.de',
                'email' => 'info@vfb.de',
                'clubColors' => 'Weiß/Rot',
                'locationIdx' => 10,
            ],
            [
                'name' => 'Hertha BSC Berlin',
                'shortName' => 'Hertha BSC',
                'abbreviation' => 'BSC',
                'stadiumName' => 'Olympiastadion',
                'foundingYear' => 1892,
                'website' => 'https://herthabsc.de',
                'email' => 'info@herthabsc.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 11,
            ],
            [
                'name' => 'SV Werder Bremen',
                'shortName' => 'Werder',
                'abbreviation' => 'SVW',
                'stadiumName' => 'wohninvest WESERSTADION',
                'foundingYear' => 1899,
                'website' => 'https://werder.de',
                'email' => 'info@werder.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 12,
            ],
            [
                'name' => 'Hamburger SV',
                'shortName' => 'HSV',
                'abbreviation' => 'HSV',
                'stadiumName' => 'Volksparkstadion',
                'foundingYear' => 1887,
                'website' => 'https://hsv.de',
                'email' => 'info@hsv.de',
                'clubColors' => 'Rot/Weiß/Blau',
                'locationIdx' => 13,
            ],
            [
                'name' => 'FC Schalke 04',
                'shortName' => 'Schalke',
                'abbreviation' => 'S04',
                'stadiumName' => 'Veltins-Arena',
                'foundingYear' => 1904,
                'website' => 'https://schalke04.de',
                'email' => 'info@schalke04.de',
                'clubColors' => 'Königsblau/Weiß',
                'locationIdx' => 14,
            ],
            [
                'name' => '1. FC Köln',
                'shortName' => '1. FC Köln',
                'abbreviation' => 'KOE',
                'stadiumName' => 'RheinEnergieStadion',
                'foundingYear' => 1948,
                'website' => 'https://fc.de',
                'email' => 'info@fc.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 15,
            ],
            // Kleine Klubs 16-24
            [
                'name' => 'Hannover 96',
                'shortName' => 'Hannover 96',
                'abbreviation' => 'H96',
                'stadiumName' => 'Heinz von Heiden Arena',
                'foundingYear' => 1896,
                'website' => 'https://hannover96.de',
                'email' => 'info@hannover96.de',
                'clubColors' => 'Rot/Schwarz',
                'locationIdx' => 16,
            ],
            [
                'name' => '1. FC Nürnberg',
                'shortName' => 'FCN',
                'abbreviation' => 'FCN',
                'stadiumName' => 'Max-Morlock-Stadion',
                'foundingYear' => 1905,
                'website' => 'https://fcn.de',
                'email' => 'info@fcn.de',
                'clubColors' => 'Dunkelrot/Weiß',
                'locationIdx' => 17,
            ],
            [
                'name' => 'Hansa Rostock',
                'shortName' => 'Hansa',
                'abbreviation' => 'HRO',
                'stadiumName' => 'Ostseestadion',
                'foundingYear' => 1965,
                'website' => 'https://fcansarostock.de',
                'email' => 'info@hansarostock.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 18,
            ],
            [
                'name' => 'SpVgg Greuther Fürth',
                'shortName' => 'Greuther Fürth',
                'abbreviation' => 'SGF',
                'stadiumName' => 'Sportpark Ronhof',
                'foundingYear' => 1903,
                'website' => 'https://greuther-fuerth.de',
                'email' => 'info@greuther-fuerth.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 19,
            ],
            [
                'name' => 'SV Sandhausen',
                'shortName' => 'SV Sandhausen',
                'abbreviation' => 'SVS',
                'stadiumName' => 'BWT-Stadion am Hardtwald',
                'foundingYear' => 1916,
                'website' => 'https://sv-sandhausen.de',
                'email' => 'info@sv-sandhausen.de',
                'clubColors' => 'Grün/Schwarz',
                'locationIdx' => 20,
            ],
            [
                'name' => 'SpVgg Unterhaching',
                'shortName' => 'Unterhaching',
                'abbreviation' => 'SPU',
                'stadiumName' => 'Alpenbauer Sportpark',
                'foundingYear' => 1925,
                'website' => 'https://spvgg-unterhaching.de',
                'email' => 'info@spvgg-unterhaching.de',
                'clubColors' => 'Grün/Weiß/Rot',
                'locationIdx' => 21,
            ],
            [
                'name' => 'KFC Uerdingen 05',
                'shortName' => 'KFC Uerdingen',
                'abbreviation' => 'KFC',
                'stadiumName' => 'Grotenburg-Stadion',
                'foundingYear' => 1905,
                'website' => 'https://kfc05.de',
                'email' => 'info@kfc05.de',
                'clubColors' => 'Rot/Blau',
                'locationIdx' => 22,
            ],
            [
                'name' => 'FC Erzgebirge Aue',
                'shortName' => 'Erzgebirge Aue',
                'abbreviation' => 'AUE',
                'stadiumName' => 'Erzgebirgsstadion',
                'foundingYear' => 1906,
                'website' => 'https://fcerzgebirge.de',
                'email' => 'info@fcerzgebirge.de',
                'clubColors' => 'Lila/Weiß',
                'locationIdx' => 23,
            ],
            [
                'name' => 'TSV 1860 München',
                'shortName' => 'TSV 1860',
                'abbreviation' => '1860',
                'stadiumName' => 'Stadion an der Grünwalder Str.',
                'foundingYear' => 1860,
                'website' => 'https://tsv1860.de',
                'email' => 'info@tsv1860.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 24,
            ],
        ];

        foreach ($clubs as $i => $data) {
            $existing = $manager->getRepository(Club::class)->findOneBy(['name' => $data['name']]);
            if ($existing) {
                $this->addReference('lt_club_' . $i, $existing);
                continue;
            }

            $club = new Club();
            $club->setName($data['name']);
            $club->setShortName($data['shortName']);
            $club->setAbbreviation($data['abbreviation']);
            $club->setStadiumName($data['stadiumName']);
            $club->setFoundingYear($data['foundingYear']);
            $club->setWebsite($data['website']);
            $club->setEmail($data['email']);
            $club->setClubColors($data['clubColors']);
            $club->setActive(true);
            /** @var Location $location */
            $location = $this->getReference('lt_location_' . $data['locationIdx'], Location::class);
            $club->setLocation($location);
            $manager->persist($club);
            $this->addReference('lt_club_' . $i, $club);
        }

        $manager->flush();
    }
}
