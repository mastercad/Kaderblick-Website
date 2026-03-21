<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\Club;
use App\Entity\Location;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: 100 deutsche Fußballvereine von Bundesliga bis Kreisliga.
 * Clubs 0-23  (24): Große Klubs → 6 Teams je = 144 Teams
 * Clubs 24-59 (36): Mittlere Klubs → 4 Teams je = 144 Teams
 * Clubs 60-99 (40): Kleine Klubs → 2 Teams je = 80 Teams
 * Gesamt: 368 Teams + SG-Teams
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
        // [name, shortName, abbr, stadiumName, foundingYear, website, email, colors, locationIdx]
        $clubs = [
            // ── Große Klubs (0-23) – je 6 Teams ──────────────────────────────
            [
                'name' => 'FC Bayern München',
                'shortName' => 'FC Bayern',
                'abbreviation' => 'FCB',
                'stadiumName' => 'Allianz Arena',
                'foundingYear' => 1900,
                'website' => 'https://fcbayern.com',
                'email' => 'info@fcbayern.com',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 0
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
                'locationIdx' => 1
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
                'locationIdx' => 2
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
                'locationIdx' => 3
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
                'locationIdx' => 4
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
                'locationIdx' => 5
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
                'locationIdx' => 6
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
                'locationIdx' => 7
            ],
            [
                'name' => 'VfL Wolfsburg',
                'shortName' => 'Wolfsburg',
                'abbreviation' => 'WOB',
                'stadiumName' => 'Volkswagen Arena',
                'foundingYear' => 1945,
                'website' => 'https://vfl-wolfsburg.de',
                'email' => 'info@vfl-wolfsburg.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 8
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
                'locationIdx' => 9
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
                'locationIdx' => 10
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
                'locationIdx' => 11
            ],
            [
                'name' => 'SV Werder Bremen',
                'shortName' => 'Werder',
                'abbreviation' => 'SVW',
                'stadiumName' => 'Weserstadion',
                'foundingYear' => 1899,
                'website' => 'https://werder.de',
                'email' => 'info@werder.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 12
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
                'locationIdx' => 13
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
                'locationIdx' => 14
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
                'locationIdx' => 15
            ],
            [
                'name' => 'Hannover 96',
                'shortName' => 'Hannover 96',
                'abbreviation' => 'H96',
                'stadiumName' => 'Heinz von Heiden Arena',
                'foundingYear' => 1896,
                'website' => 'https://hannover96.de',
                'email' => 'info@hannover96.de',
                'clubColors' => 'Rot/Schwarz',
                'locationIdx' => 16
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
                'locationIdx' => 17
            ],
            [
                'name' => 'Hansa Rostock',
                'shortName' => 'Hansa',
                'abbreviation' => 'HRO',
                'stadiumName' => 'Ostseestadion',
                'foundingYear' => 1965,
                'website' => 'https://hansarostock.de',
                'email' => 'info@hansarostock.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 18
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
                'locationIdx' => 19
            ],
            [
                'name' => 'FC St. Pauli',
                'shortName' => 'St. Pauli',
                'abbreviation' => 'STP',
                'stadiumName' => 'Millerntor-Stadion',
                'foundingYear' => 1910,
                'website' => 'https://fcstpauli.com',
                'email' => 'info@fcstpauli.com',
                'clubColors' => 'Braun/Weiß',
                'locationIdx' => 56
            ],
            [
                'name' => 'Werder Bremen II',
                'shortName' => 'Werder II',
                'abbreviation' => 'SVW2',
                'stadiumName' => 'Weserstadion Platz 11',
                'foundingYear' => 1899,
                'website' => 'https://werder.de',
                'email' => 'info2@werder.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 12
            ],
            [
                'name' => '1. FC Magdeburg',
                'shortName' => 'FCM',
                'abbreviation' => 'FCM',
                'stadiumName' => 'MDCC-Arena',
                'foundingYear' => 1965,
                'website' => 'https://fcmagdeburg.de',
                'email' => 'info@fcmagdeburg.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 31
            ],
            [
                'name' => 'SV Meppen',
                'shortName' => 'Meppen',
                'abbreviation' => 'SVM',
                'stadiumName' => 'Hänsch-Arena',
                'foundingYear' => 1912,
                'website' => 'https://sv-meppen.de',
                'email' => 'info@sv-meppen.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 32
            ],
            // ── Mittlere Klubs (24-59) – je 4 Teams ─────────────────────────
            [
                'name' => 'FC Ingolstadt 04',
                'shortName' => 'Ingolstadt',
                'abbreviation' => 'FCI',
                'stadiumName' => 'Audi Sportpark',
                'foundingYear' => 2004,
                'website' => 'https://fcingolstadt.de',
                'email' => 'info@fcingolstadt.de',
                'clubColors' => 'Dunkelblau/Weiß/Rot',
                'locationIdx' => 33
            ],
            [
                'name' => 'SC Paderborn 07',
                'shortName' => 'Paderborn',
                'abbreviation' => 'SCP',
                'stadiumName' => 'Benteler Arena',
                'foundingYear' => 1907,
                'website' => 'https://scpaderborn07.de',
                'email' => 'info@scpaderborn07.de',
                'clubColors' => 'Dunkelblau/Weiß',
                'locationIdx' => 34
            ],
            [
                'name' => 'SSV Jahn Regensburg',
                'shortName' => 'Jahn Regensburg',
                'abbreviation' => 'SSV',
                'stadiumName' => 'Continental Arena',
                'foundingYear' => 1907,
                'website' => 'https://jahnregensburg.de',
                'email' => 'info@jahnregensburg.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 35
            ],
            [
                'name' => 'SV Wehen Wiesbaden',
                'shortName' => 'Wehen Wiesbaden',
                'abbreviation' => 'SVWW',
                'stadiumName' => 'BRITA-Arena',
                'foundingYear' => 1926,
                'website' => 'https://svww.de',
                'email' => 'info@svww.de',
                'clubColors' => 'Blau/Orange',
                'locationIdx' => 36
            ],
            [
                'name' => 'SSV Ulm 1846',
                'shortName' => 'Ulm 1846',
                'abbreviation' => 'SSV',
                'stadiumName' => 'Donaustadion',
                'foundingYear' => 1846,
                'website' => 'https://ssvulm.de',
                'email' => 'info@ssvulm.de',
                'clubColors' => 'Weiß/Schwarz',
                'locationIdx' => 37
            ],
            [
                'name' => 'SC Preußen Münster',
                'shortName' => 'Preußen Münster',
                'abbreviation' => 'SCM',
                'stadiumName' => 'Preußenstadion',
                'foundingYear' => 1906,
                'website' => 'https://sc-preussen-muenster.de',
                'email' => 'info@sc-preussen-muenster.de',
                'clubColors' => 'Schwarz/Weiß',
                'locationIdx' => 38
            ],
            [
                'name' => 'SV Elversberg',
                'shortName' => 'Elversberg',
                'abbreviation' => 'SVE',
                'stadiumName' => 'URSAPHARM Arena',
                'foundingYear' => 1907,
                'website' => 'https://sv-elversberg.de',
                'email' => 'info@sv-elversberg.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 39
            ],
            [
                'name' => 'Eintracht Braunschweig',
                'shortName' => 'Braunschweig',
                'abbreviation' => 'EBS',
                'stadiumName' => 'Eintracht-Stadion',
                'foundingYear' => 1895,
                'website' => 'https://eintracht-braunschweig.de',
                'email' => 'info@eintracht-braunschweig.de',
                'clubColors' => 'Gelb/Blau',
                'locationIdx' => 40
            ],
            [
                'name' => 'Dynamo Dresden',
                'shortName' => 'Dynamo',
                'abbreviation' => 'SGD',
                'stadiumName' => 'Rudolf-Harbig-Stadion',
                'foundingYear' => 1953,
                'website' => 'https://dynamo-dresden.de',
                'email' => 'info@dynamo-dresden.de',
                'clubColors' => 'Gelb/Schwarz',
                'locationIdx' => 41
            ],
            [
                'name' => 'Hallescher FC',
                'shortName' => 'HFC',
                'abbreviation' => 'HFC',
                'stadiumName' => 'Erdgas Sportpark',
                'foundingYear' => 1966,
                'website' => 'https://hallescher-fc.de',
                'email' => 'info@hallescher-fc.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 42
            ],
            [
                'name' => 'FC Energie Cottbus',
                'shortName' => 'Cottbus',
                'abbreviation' => 'FCE',
                'stadiumName' => 'Stadion der Freundschaft',
                'foundingYear' => 1963,
                'website' => 'https://fcenergie.de',
                'email' => 'info@fcenergie.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 43
            ],
            [
                'name' => 'SV Waldhof Mannheim',
                'shortName' => 'Waldhof Mannheim',
                'abbreviation' => 'SWM',
                'stapediumName' => 'Carl-Benz-Stadion',
                'foundingYear' => 1907,
                'website' => 'https://waldhof-mannheim.de',
                'email' => 'info@waldhof-mannheim.de',
                'clubColors' => 'Blau/Schwarz',
                'locationIdx' => 44,
                'stadiumName' => 'Carl-Benz-Stadion'
            ],
            [
                'name' => 'VfL Bochum 1848',
                'shortName' => 'VfL Bochum',
                'abbreviation' => 'BOC',
                'stadiumName' => 'Vonovia Ruhrstadion',
                'foundingYear' => 1848,
                'website' => 'https://vfl-bochum.de',
                'email' => 'info@vfl-bochum.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 45
            ],
            [
                'name' => 'SV Darmstadt 98',
                'shortName' => 'Darmstadt',
                'abbreviation' => 'D98',
                'stadiumName' => 'Merck-Stadion',
                'foundingYear' => 1898,
                'website' => 'https://sv98.de',
                'email' => 'info@sv98.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 46
            ],
            [
                'name' => 'FC Heidenheim',
                'shortName' => 'Heidenheim',
                'abbreviation' => 'FCH',
                'stadiumName' => 'Voith-Arena',
                'foundingYear' => 1846,
                'website' => 'https://fc-heidenheim.de',
                'email' => 'info@fc-heidenheim.de',
                'clubColors' => 'Rot/Schwarz',
                'locationIdx' => 47
            ],
            [
                'name' => 'Rot-Weiß Essen',
                'shortName' => 'RWE',
                'abbreviation' => 'RWE',
                'stadiumName' => 'Stadion Essen',
                'foundingYear' => 1907,
                'website' => 'https://rot-weiss-essen.de',
                'email' => 'info@rot-weiss-essen.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 48
            ],
            [
                'name' => 'MSV Duisburg',
                'shortName' => 'MSV Duisburg',
                'abbreviation' => 'MSV',
                'stadiumName' => 'Schauinsland-Reisen-Arena',
                'foundingYear' => 1902,
                'website' => 'https://msv-duisburg.de',
                'email' => 'info@msv-duisburg.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 49
            ],
            [
                'name' => '1. FC Saarbrücken',
                'shortName' => 'Saarbrücken',
                'abbreviation' => 'FCS',
                'stadiumName' => 'Ludwigspark-Stadion',
                'foundingYear' => 1903,
                'website' => 'https://fcsaarbruecken.de',
                'email' => 'info@fcsaarbruecken.de',
                'clubColors' => 'Blau/Schwarz',
                'locationIdx' => 50
            ],
            [
                'name' => 'Sportfreunde Siegen',
                'shortName' => 'SF Siegen',
                'abbreviation' => 'SFS',
                'stadiumName' => 'Leimbachstadion',
                'foundingYear' => 1899,
                'website' => 'https://sf-siegen.de',
                'email' => 'info@sf-siegen.de',
                'clubColors' => 'Blau/Schwarz',
                'locationIdx' => 51
            ],
            [
                'name' => 'Alemannia Aachen',
                'shortName' => 'Aachen',
                'abbreviation' => 'TSV',
                'stadiumName' => 'Tivoli',
                'foundingYear' => 1900,
                'website' => 'https://alemannia-aachen.de',
                'email' => 'info@alemannia-aachen.de',
                'clubColors' => 'Schwarz/Gelb',
                'locationIdx' => 52
            ],
            [
                'name' => 'SC Verl',
                'shortName' => 'SC Verl',
                'abbreviation' => 'SCV',
                'stadiumName' => 'Forum Flutlicht Arena',
                'foundingYear' => 1919,
                'website' => 'https://sc-verl.de',
                'email' => 'info@sc-verl.de',
                'clubColors' => 'Blau/Grün',
                'locationIdx' => 53
            ],
            [
                'name' => 'Wuppertaler SV',
                'shortName' => 'WSV',
                'abbreviation' => 'WSV',
                'stadiumName' => 'Zoo-Stadion',
                'foundingYear' => 1914,
                'website' => 'https://wuppertaler-sv.de',
                'email' => 'info@wuppertaler-sv.de',
                'clubColors' => 'Rot/Blau',
                'locationIdx' => 54
            ],
            [
                'name' => 'Holstein Kiel',
                'shortName' => 'Kiel',
                'abbreviation' => 'KSV',
                'stadiumName' => 'Holstein-Stadion',
                'foundingYear' => 1900,
                'website' => 'https://holstein-kiel.de',
                'email' => 'info@holstein-kiel.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 55
            ],
            [
                'name' => 'FC Rot-Weiß Koblenz',
                'shortName' => 'RW Koblenz',
                'abbreviation' => 'RWK',
                'stadiumName' => 'Stadion Oberwerth',
                'foundingYear' => 1904,
                'website' => 'https://rw-koblenz.de',
                'email' => 'info@rw-koblenz.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 57
            ],
            [
                'name' => 'VfB Oldenburg',
                'shortName' => 'Oldenburg',
                'abbreviation' => 'VFO',
                'stadiumName' => 'Marschwegstadion',
                'foundingYear' => 1897,
                'website' => 'https://vfb-oldenburg.de',
                'email' => 'info@vfb-oldenburg.de',
                'clubColors' => 'Blau/Gelb',
                'locationIdx' => 57
            ],
            [
                'name' => 'FC Carl Zeiss Jena',
                'shortName' => 'Carl Zeiss Jena',
                'abbreviation' => 'CZJ',
                'stadiumName' => 'Ernst-Abbe-Sportfeld',
                'foundingYear' => 1903,
                'website' => 'https://fc-carl-zeiss-jena.de',
                'email' => 'info@fc-carl-zeiss-jena.de',
                'clubColors' => 'Blau/Gelb',
                'locationIdx' => 58
            ],
            [
                'name' => 'FC Plauen',
                'shortName' => 'FC Plauen',
                'abbreviation' => 'FCP',
                'stadiumName' => 'Vogtlandstadion',
                'foundingYear' => 1903,
                'website' => 'https://fcplauen.de',
                'email' => 'info@fcplauen.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 59
            ],
            [
                'name' => 'Babelsberg 03',
                'shortName' => 'Babelsberg',
                'abbreviation' => 'SVB',
                'stadiumName' => 'Karl-Liebknecht-Stadion',
                'foundingYear' => 1903,
                'website' => 'https://babelsberg03.de',
                'email' => 'info@babelsberg03.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 59
            ],
            // ── Kleine Klubs (60-99) – je 2 Teams ──────────────────────────
            [
                'name' => 'SV Sandhausen',
                'shortName' => 'SV Sandhausen',
                'abbreviation' => 'SVS',
                'stadiumName' => 'BWT-Stadion am Hardtwald',
                'foundingYear' => 1916,
                'website' => 'https://sv-sandhausen.de',
                'email' => 'info@sv-sandhausen.de',
                'clubColors' => 'Grün/Schwarz',
                'locationIdx' => 20
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
                'locationIdx' => 21
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
                'locationIdx' => 22
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
                'locationIdx' => 23
            ],
            [
                'name' => 'TSV 1860 München',
                'shortName' => 'TSV 1860',
                'abbreviation' => '1860',
                'stadiumName' => 'Stadion Grünwalder Str.',
                'foundingYear' => 1860,
                'website' => 'https://tsv1860.de',
                'email' => 'info@tsv1860.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 24
            ],
            [
                'name' => 'FC Bayern München II',
                'shortName' => 'FC Bayern II',
                'abbreviation' => 'FCB2',
                'stadiumName' => 'FC Bayern Campus',
                'foundingYear' => 1900,
                'website' => 'https://fcbayern.com',
                'email' => 'info2@fcbayern.com',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 25
            ],
            [
                'name' => 'BVB Dortmund II',
                'shortName' => 'BVB II',
                'abbreviation' => 'BVB2',
                'stadiumName' => 'Stadion Brackel',
                'foundingYear' => 1909,
                'website' => 'https://bvb.de',
                'email' => 'info2@bvb.de',
                'clubColors' => 'Schwarz/Gelb',
                'locationIdx' => 26
            ],
            [
                'name' => 'Hamburger SV II',
                'shortName' => 'HSV II',
                'abbreviation' => 'HSV2',
                'stadiumName' => 'Volkspark Nord',
                'foundingYear' => 1887,
                'website' => 'https://hsv.de',
                'email' => 'info2@hsv.de',
                'clubColors' => 'Rot/Weiß/Blau',
                'locationIdx' => 27
            ],
            [
                'name' => 'Eintracht Frankfurt II',
                'shortName' => 'Eintracht II',
                'abbreviation' => 'SGE2',
                'stadiumName' => 'Sportpark Wörthstr.',
                'foundingYear' => 1899,
                'website' => 'https://eintracht.de',
                'email' => 'info2@eintracht.de',
                'clubColors' => 'Schwarz/Weiß/Rot',
                'locationIdx' => 28
            ],
            [
                'name' => 'SV Türkgücü München',
                'shortName' => 'Türkgücü',
                'abbreviation' => 'TGM',
                'stadiumName' => 'Olympiastadion München',
                'foundingYear' => 1975,
                'website' => 'https://tuerkguecue-muenchen.de',
                'email' => 'info@tuerkguecue.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 29
            ],
            [
                'name' => 'SV Rödinghausen',
                'shortName' => 'Rödinghausen',
                'abbreviation' => 'SVR',
                'stadiumName' => 'Häcker Wiehenstadion',
                'foundingYear' => 1920,
                'website' => 'https://sv-roedinghausen.de',
                'email' => 'info@sv-roedinghausen.de',
                'clubColors' => 'Blau/Schwarz',
                'locationIdx' => 30
            ],
            [
                'name' => 'Berliner AK 07',
                'shortName' => 'BAK 07',
                'abbreviation' => 'BAK',
                'stadiumName' => 'Mommsenstadion',
                'foundingYear' => 1907,
                'website' => 'https://bak07.de',
                'email' => 'info@bak07.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 31
            ],
            [
                'name' => 'FC Gütersloh',
                'shortName' => 'FC Gütersloh',
                'abbreviation' => 'FCG',
                'stadiumName' => 'Heidewald Stadion',
                'foundingYear' => 1910,
                'website' => 'https://fcgütersloh.de',
                'email' => 'info@fcgütersloh.de',
                'clubColors' => 'Schwarz/Rot',
                'locationIdx' => 32
            ],
            [
                'name' => 'FC Viktoria Köln',
                'shortName' => 'Viktoria Köln',
                'abbreviation' => 'VKL',
                'stadiumName' => 'Sportpark Höhenberg',
                'foundingYear' => 1904,
                'website' => 'https://viktoria-koeln.de',
                'email' => 'info@viktoria-koeln.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 33
            ],
            [
                'name' => 'Fortuna Köln',
                'shortName' => 'Fortuna Köln',
                'abbreviation' => 'FLK',
                'stadiumName' => 'Südstadion',
                'foundingYear' => 1948,
                'website' => 'https://sc-fortuna-koeln.de',
                'email' => 'info@sc-fortuna-koeln.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 34
            ],
            [
                'name' => 'SG Wattenscheid 09',
                'shortName' => 'Wattenscheid',
                'abbreviation' => 'SGW',
                'stadiumName' => 'Lohrheidestadion',
                'foundingYear' => 1909,
                'website' => 'https://sgwattenscheid09.de',
                'email' => 'info@sgwattenscheid09.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 35
            ],
            [
                'name' => 'TuS Koblenz',
                'shortName' => 'TuS Koblenz',
                'abbreviation' => 'TUS',
                'stadiumName' => 'Rhein-Mosel-Stadion',
                'foundingYear' => 1911,
                'website' => 'https://tuskoblenz.de',
                'email' => 'info@tuskoblenz.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 36
            ],
            [
                'name' => 'SpVgg Bayreuth',
                'shortName' => 'SpVgg Bayreuth',
                'abbreviation' => 'SPB',
                'stadiumName' => 'Stadion Lohfeld',
                'foundingYear' => 1921,
                'website' => 'https://spvgg-bayreuth.de',
                'email' => 'info@spvgg-bayreuth.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 37
            ],
            [
                'name' => 'Würzburger Kickers',
                'shortName' => 'Würzburg',
                'abbreviation' => 'FWK',
                'stadiumName' => 'Fly Samic Arena',
                'foundingYear' => 1907,
                'website' => 'https://wuerzburger-kickers.de',
                'email' => 'info@wuerzburger-kickers.de',
                'clubColors' => 'Rot/Blau',
                'locationIdx' => 38
            ],
            [
                'name' => 'FC Schweinfurt 05',
                'shortName' => 'Schweinfurt',
                'abbreviation' => 'FCS',
                'stadiumName' => 'Schweinfurter Willy-Sachs-Stadion',
                'foundingYear' => 1905,
                'website' => 'https://fc-schweinfurt-05.de',
                'email' => 'info@fc-schweinfurt-05.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 39
            ],
            [
                'name' => 'VfR Aalen',
                'shortName' => 'VfR Aalen',
                'abbreviation' => 'VRA',
                'stadiumName' => 'Ostalb Arena',
                'foundingYear' => 1921,
                'website' => 'https://vfr-aalen.de',
                'email' => 'info@vfr-aalen.de',
                'clubColors' => 'Schwarz/Rot',
                'locationIdx' => 40
            ],
            [
                'name' => 'Stuttgarter Kickers',
                'shortName' => 'Stuttgarter Kickers',
                'abbreviation' => 'SV',
                'stadiumName' => 'Gazi Stadion auf der Waldau',
                'foundingYear' => 1899,
                'website' => 'https://stuttgarter-kickers.de',
                'email' => 'info@stuttgarter-kickers.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 41
            ],
            [
                'name' => 'VfV Hildesheim',
                'shortName' => 'Hildesheim',
                'abbreviation' => 'VFV',
                'stadiumName' => 'Heidbergstadion',
                'foundingYear' => 1905,
                'website' => 'https://vfv-hildesheim.de',
                'email' => 'info@vfv-hildesheim.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 42
            ],
            [
                'name' => 'TSV Havelse',
                'shortName' => 'TSV Havelse',
                'abbreviation' => 'TSH',
                'stadiumName' => 'Sportpark Havelse',
                'foundingYear' => 1912,
                'website' => 'https://tsv-havelse.de',
                'email' => 'info@tsv-havelse.de',
                'clubColors' => 'Rot/Schwarz',
                'locationIdx' => 43
            ],
            [
                'name' => 'Eintracht Celle FC',
                'shortName' => 'Celle FC',
                'abbreviation' => 'ECF',
                'stadiumName' => 'Stadion An der Heese',
                'foundingYear' => 1901,
                'website' => 'https://eintracht-celle.de',
                'email' => 'info@eintracht-celle.de',
                'clubColors' => 'Blau/Schwarz',
                'locationIdx' => 44
            ],
            [
                'name' => 'SV Atlas Delmenhorst',
                'shortName' => 'Atlas Delmenhorst',
                'abbreviation' => 'SVA',
                'stadiumName' => 'Düsternorter EWE Stadion',
                'foundingYear' => 1920,
                'website' => 'https://atlas-delmenhorst.de',
                'email' => 'info@atlas-delmenhorst.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 45
            ],
            [
                'name' => 'SV Sparta Lichtenberg',
                'shortName' => 'Sparta Lichtenberg',
                'abbreviation' => 'SSL',
                'stadiumName' => 'Jahnsportpark',
                'foundingYear' => 1900,
                'website' => 'https://sv-sparta.de',
                'email' => 'info@sv-sparta.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 46
            ],
            [
                'name' => 'VfV Borussia 06 Hildesheim',
                'shortName' => 'Borussia Hildesheim',
                'abbreviation' => 'VBH',
                'stadiumName' => 'Heidbergstadion',
                'foundingYear' => 1906,
                'website' => 'https://borussia-hildesheim.de',
                'email' => 'info@borussia-hildesheim.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 47
            ],
            [
                'name' => 'TuS RW Koblenz',
                'shortName' => 'RW Koblenz',
                'abbreviation' => 'RWK',
                'stadiumName' => 'Rhein-Mosel Sportpark',
                'foundingYear' => 1951,
                'website' => 'https://tus-rw-koblenz.de',
                'email' => 'info@tus-rw-koblenz.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 48
            ],
            [
                'name' => 'FC Astoria Walldorf',
                'shortName' => 'Walldorf',
                'abbreviation' => 'FCW',
                'stadiumName' => 'Hardtwald-Stadion',
                'foundingYear' => 1907,
                'website' => 'https://fc-astoria-walldorf.de',
                'email' => 'info@fc-astoria-walldorf.de',
                'clubColors' => 'Rot/Schwarz',
                'locationIdx' => 49
            ],
            [
                'name' => 'FC Homburg',
                'shortName' => 'FC Homburg',
                'abbreviation' => 'FCH',
                'stadiumName' => 'Waldstadion Homburg',
                'foundingYear' => 1908,
                'website' => 'https://fc-homburg.de',
                'email' => 'info@fc-homburg.de',
                'clubColors' => 'Schwarz/Weiß',
                'locationIdx' => 50
            ],
            [
                'name' => 'SV Gonsenheim',
                'shortName' => 'SV Gonsenheim',
                'abbreviation' => 'SVG',
                'stadiumName' => 'Sportanlage Lennebergwald',
                'foundingYear' => 1909,
                'website' => 'https://sv-gonsenheim.de',
                'email' => 'info@sv-gonsenheim.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 51
            ],
            [
                'name' => 'Sportfreunde Eisbachtal',
                'shortName' => 'Eisbachtal',
                'abbreviation' => 'SFE',
                'stadiumName' => 'Sportanlage Eisbachtal',
                'foundingYear' => 1962,
                'website' => 'https://sf-eisbachtal.de',
                'email' => 'info@sf-eisbachtal.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 52
            ],
            [
                'name' => 'FC Trier',
                'shortName' => 'FC Trier',
                'abbreviation' => 'FCT',
                'stadiumName' => 'Moselstadion',
                'foundingYear' => 1904,
                'website' => 'https://fctrier.de',
                'email' => 'info@fctrier.de',
                'clubColors' => 'Rot/Schwarz',
                'locationIdx' => 53
            ],
            [
                'name' => 'FK Pirmasens',
                'shortName' => 'FK Pirmasens',
                'abbreviation' => 'FKP',
                'stadiumName' => 'Husterhöhe',
                'foundingYear' => 1904,
                'website' => 'https://fk-pirmasens.de',
                'email' => 'info@fk-pirmasens.de',
                'clubColors' => 'Blau/Gelb',
                'locationIdx' => 54
            ],
            [
                'name' => 'TuS Mechtersheim',
                'shortName' => 'Mechtersheim',
                'abbreviation' => 'TUM',
                'stadiumName' => 'Bürgerstadion',
                'foundingYear' => 1920,
                'website' => 'https://tus-mechtersheim.de',
                'email' => 'info@tus-mechtersheim.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 55
            ],
            [
                'name' => 'FC Deidesheim',
                'shortName' => 'FC Deidesheim',
                'abbreviation' => 'FCD',
                'stadiumName' => 'Stadtpark',
                'foundingYear' => 1908,
                'website' => 'https://fc-deidesheim.de',
                'email' => 'info@fc-deidesheim.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 56
            ],
            [
                'name' => 'SG Rehborn',
                'shortName' => 'SG Rehborn',
                'abbreviation' => 'SGR',
                'stadiumName' => 'Sportanlage Rehborn',
                'foundingYear' => 1950,
                'website' => 'https://sg-rehborn.de',
                'email' => 'info@sg-rehborn.de',
                'clubColors' => 'Schwarz/Weiß',
                'locationIdx' => 57
            ],
            [
                'name' => 'VfB Bodenheim',
                'shortName' => 'VfB Bodenheim',
                'abbreviation' => 'VBB',
                'stadiumName' => 'Sportplatz Im Stadtwald',
                'foundingYear' => 1925,
                'website' => 'https://vfb-bodenheim.de',
                'email' => 'info@vfb-bodenheim.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 58
            ],
            [
                'name' => 'SC 07 Idar-Oberstein',
                'shortName' => 'SC Idar-Oberstein',
                'abbreviation' => 'SCI',
                'stadiumName' => 'Nahe-Stadion',
                'foundingYear' => 1907,
                'website' => 'https://sc07idaro.de',
                'email' => 'info@sc07idaro.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 59
            ],
            [
                'name' => 'SSV Ulm 1846 II',
                'shortName' => 'Ulm II',
                'abbreviation' => 'SSV2',
                'stadiumName' => 'Donaustadion Nebenplatz',
                'foundingYear' => 1846,
                'website' => 'https://ssvulm.de',
                'email' => 'info2@ssvulm.de',
                'clubColors' => 'Weiß/Schwarz',
                'locationIdx' => 0
            ],
            [
                'name' => 'SV Sandhausen II',
                'shortName' => 'Sandhausen II',
                'abbreviation' => 'SVS2',
                'stadiumName' => 'BWT-Stadion Nebenplatz',
                'foundingYear' => 1916,
                'website' => 'https://sv-sandhausen.de',
                'email' => 'info2@sv-sandhausen.de',
                'clubColors' => 'Grün/Schwarz',
                'locationIdx' => 1
            ],
            [
                'name' => 'VfB Lübeck',
                'shortName' => 'VfB Lübeck',
                'abbreviation' => 'VBL',
                'stadiumName' => 'Lohmühle',
                'foundingYear' => 1919,
                'website' => 'https://vfb-luebeck.de',
                'email' => 'info@vfb-luebeck.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 2
            ],
            [
                'name' => 'SC Teutonia 05',
                'shortName' => 'Teutonia 05',
                'abbreviation' => 'SCT',
                'stadiumName' => 'Teutonia-Stadion',
                'foundingYear' => 1905,
                'website' => 'https://sc-teutonia05.de',
                'email' => 'info@sc-teutonia05.de',
                'clubColors' => 'Grün/Weiß',
                'locationIdx' => 3
            ],
            [
                'name' => 'TSV Schott Mainz',
                'shortName' => 'Schott Mainz',
                'abbreviation' => 'TSM',
                'stadiumName' => 'Schott-Sportpark',
                'foundingYear' => 1921,
                'website' => 'https://tsvschott.de',
                'email' => 'info@tsvschott.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 4
            ],
            [
                'name' => 'Rot-Weiss Ahlen',
                'shortName' => 'RW Ahlen',
                'abbreviation' => 'RWA',
                'stadiumName' => 'Werse-Stadion',
                'foundingYear' => 1996,
                'website' => 'https://rot-weiss-ahlen.de',
                'email' => 'info@rot-weiss-ahlen.de',
                'clubColors' => 'Rot/Weiß',
                'locationIdx' => 5
            ],
            [
                'name' => 'VfB Homberg',
                'shortName' => 'VfB Homberg',
                'abbreviation' => 'VHO',
                'stadiumName' => 'Volkspark-Stadion',
                'foundingYear' => 1904,
                'website' => 'https://vfb-homberg.de',
                'email' => 'info@vfb-homberg.de',
                'clubColors' => 'Blau/Weiß',
                'locationIdx' => 6
            ],
            [
                'name' => 'SC Union Nettetal',
                'shortName' => 'SC Nettetal',
                'abbreviation' => 'SCN',
                'stadiumName' => 'Fußballpark Nettetal',
                'foundingYear' => 1970,
                'website' => 'https://sc-union-nettetal.de',
                'email' => 'info@sc-union-nettetal.de',
                'clubColors' => 'Schwarz/Weiß',
                'locationIdx' => 7
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
