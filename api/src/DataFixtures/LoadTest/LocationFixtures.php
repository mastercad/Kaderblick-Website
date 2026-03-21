<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\SurfaceTypeFixtures;
use App\Entity\Location;
use App\Entity\SurfaceType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: 100 Sportstätten – eine pro Verein (clubIdx 0–99).
 * Referenzschlüssel: lt_location_0 … lt_location_99
 * Gruppe: load_test.
 */
class LocationFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            SurfaceTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        // Realistischer Belagstyp-Mix: 38% Naturrasen, 30% Kunstrasen, 18% Asche, 9% Hybridrasen, 5% Hartplatz
        $surfacePattern = [
            'naturrasen', 'kunstrasen', 'naturrasen', 'asche',      'kunstrasen',
            'naturrasen', 'hybridrasen', 'kunstrasen', 'naturrasen', 'asche',
            'kunstrasen', 'naturrasen', 'asche',      'kunstrasen', 'naturrasen',
            'hybridrasen', 'naturrasen', 'kunstrasen', 'hartplatz',  'naturrasen',
        ];

        /** @var array<string, SurfaceType> $surfaceTypes */
        $surfaceTypes = [];
        foreach (['naturrasen', 'kunstrasen', 'asche', 'hartplatz', 'hybridrasen'] as $key) {
            $surfaceTypes[$key] = $this->getReference('surface_type_' . $key, SurfaceType::class);
        }

        // Eine Sportanlage pro Verein (clubIdx 0–99).
        // Reihenfolge: 24 große Klubs → 36 mittlere Klubs → 40 kleine Klubs.
        $locations = [
            // ── Große Klubs (clubIdx 0–23) ─────────────────────────────────
            // 0  FC Bayern München
            [
                'name' => 'Sportanlage Säbener Straße München',
                'address' => 'Säbener Str. 51',
                'city' => 'München',
                'lat' => 48.0833,
                'lng' => 11.5666,
                'capacity' => 12000
            ],
            // 1  Borussia Dortmund
            [
                'name' => 'Trainingszentrum Brackel Dortmund',
                'address' => 'Strobelallee 50',
                'city' => 'Dortmund',
                'lat' => 51.5195,
                'lng' => 7.5198,
                'capacity' => 8000
            ],
            // 2  Bayer 04 Leverkusen
            [
                'name' => 'Sportpark Bayer Leverkusen',
                'address' => 'Bismarckstr. 122',
                'city' => 'Leverkusen',
                'lat' => 51.0382,
                'lng' => 7.0023,
                'capacity' => 7500
            ],
            // 3  RB Leipzig
            [
                'name' => 'Sportanlage Sachsendorf Leipzig',
                'address' => 'Am Sachsenring 22',
                'city' => 'Leipzig',
                'lat' => 51.3397,
                'lng' => 12.3731,
                'capacity' => 6000
            ],
            // 4  Borussia Mönchengladbach
            [
                'name' => 'Sportpark Niederrhein Mönchengladbach',
                'address' => 'Nordparkstr. 400',
                'city' => 'Mönchengladbach',
                'lat' => 51.2012,
                'lng' => 6.4315,
                'capacity' => 5500
            ],
            // 5  Eintracht Frankfurt
            [
                'name' => 'Vereinsgelände Bornheim Frankfurt',
                'address' => 'Hans-Böckler-Str. 13',
                'city' => 'Frankfurt am Main',
                'lat' => 50.1219,
                'lng' => 8.6823,
                'capacity' => 6200
            ],
            // 6  SC Freiburg
            [
                'name' => 'Dreisamstadion Nebenplatz Freiburg',
                'address' => 'Schwarzwaldstr. 193',
                'city' => 'Freiburg im Breisgau',
                'lat' => 47.9856,
                'lng' => 7.8299,
                'capacity' => 4800
            ],
            // 7  TSG 1899 Hoffenheim
            [
                'name' => 'Sportzentrum Kraichgau Sinsheim',
                'address' => 'Dietmar-Hopp-Str. 5',
                'city' => 'Sinsheim',
                'lat' => 49.2382,
                'lng' => 8.8898,
                'capacity' => 5000
            ],
            // 8  VfL Wolfsburg
            [
                'name' => 'VfL-Sportpark Wolfsburg',
                'address' => 'Werner-Nienaber-Str. 4',
                'city' => 'Wolfsburg',
                'lat' => 52.4227,
                'lng' => 10.7866,
                'capacity' => 5700
            ],
            // 9  FC Augsburg
            [
                'name' => 'Sportzentrum Augsburger Süden',
                'address' => 'Haunstetter Str. 200',
                'city' => 'Augsburg',
                'lat' => 48.3295,
                'lng' => 10.9116,
                'capacity' => 4200
            ],
            // 10 VfB Stuttgart
            [
                'name' => 'Sportpark Cannstatt Stuttgart',
                'address' => 'Mercedesstr. 87',
                'city' => 'Stuttgart',
                'lat' => 48.7943,
                'lng' => 9.2317,
                'capacity' => 6800
            ],
            // 11 Hertha BSC Berlin
            [
                'name' => 'Sportanlage Hertha BSC Berlin',
                'address' => 'Hanns-Braun-Str. 50',
                'city' => 'Berlin',
                'lat' => 52.5144,
                'lng' => 13.2399,
                'capacity' => 5000
            ],
            // 12 SV Werder Bremen
            [
                'name' => 'Weserstadion Nebenplätze Bremen',
                'address' => 'Franz-Böhmert-Str. 1c',
                'city' => 'Bremen',
                'lat' => 53.0666,
                'lng' => 8.8376,
                'capacity' => 5900
            ],
            // 13 Hamburger SV
            [
                'name' => 'Volksparkstadion Trainingsgelände Hamburg',
                'address' => 'Sylvesterallee 7',
                'city' => 'Hamburg',
                'lat' => 53.5872,
                'lng' => 9.8983,
                'capacity' => 9000
            ],
            // 14 FC Schalke 04
            [
                'name' => 'Vereinssportanlage Buer Gelsenkirchen',
                'address' => 'Parkallee 55',
                'city' => 'Gelsenkirchen',
                'lat' => 51.5675,
                'lng' => 7.0678,
                'capacity' => 4600
            ],
            // 15 1. FC Köln
            [
                'name' => 'Franz-Kremer-Stadion Köln',
                'address' => 'Aachener Str. 999',
                'city' => 'Köln',
                'lat' => 50.9333,
                'lng' => 6.9583,
                'capacity' => 5100
            ],
            // 16 Hannover 96
            [
                'name' => 'Sportpark Hannover 96',
                'address' => 'Robert-Enke-Str. 1',
                'city' => 'Hannover',
                'lat' => 52.3739,
                'lng' => 9.7381,
                'capacity' => 4300
            ],
            // 17 1. FC Nürnberg
            [
                'name' => 'Sportanlage Zabo Nürnberg',
                'address' => 'Zerzabelshofstr. 25',
                'city' => 'Nürnberg',
                'lat' => 49.4568,
                'lng' => 11.1127,
                'capacity' => 4000
            ],
            // 18 Hansa Rostock
            [
                'name' => 'Sportpark Hanseviertel Rostock',
                'address' => 'Hammer Str. 7',
                'city' => 'Rostock',
                'lat' => 54.0836,
                'lng' => 12.1350,
                'capacity' => 3500
            ],
            // 19 SpVgg Greuther Fürth
            [
                'name' => 'Sportzentrum Ronhof Fürth',
                'address' => 'Laubenweg 600',
                'city' => 'Fürth',
                'lat' => 49.4780,
                'lng' => 10.9923,
                'capacity' => 4200
            ],
            // 20 FC St. Pauli
            [
                'name' => 'Sportanlage Kollaustr. Hamburg',
                'address' => 'Kollaustr. 59',
                'city' => 'Hamburg',
                'lat' => 53.5930,
                'lng' => 9.9200,
                'capacity' => 2800
            ],
            // 21 Werder Bremen II
            [
                'name' => 'Hauptspielfeld Bürgerpark Bremen',
                'address' => 'In den Hullen 11',
                'city' => 'Bremen',
                'lat' => 53.0800,
                'lng' => 8.8200,
                'capacity' => 1800
            ],
            // 22 1. FC Magdeburg
            [
                'name' => 'MDCC-Arena Nebenplatz Magdeburg',
                'address' => 'Breiter Weg 200',
                'city' => 'Magdeburg',
                'lat' => 52.1205,
                'lng' => 11.6276,
                'capacity' => 5000
            ],
            // 23 SV Meppen
            [
                'name' => 'Hänsch-Arena Meppen',
                'address' => 'Nödikereweg 1',
                'city' => 'Meppen',
                'lat' => 52.6853,
                'lng' => 7.2928,
                'capacity' => 4200
            ],

            // ── Mittlere Klubs (clubIdx 24–59) ───────────────────────────────
            // 24 FC Ingolstadt 04
            [
                'name' => 'Audi Sportpark Nebenplatz Ingolstadt',
                'address' => 'Manchinger Str. 100',
                'city' => 'Ingolstadt',
                'lat' => 48.7503,
                'lng' => 11.4225,
                'capacity' => 3500
            ],
            // 25 SC Paderborn 07
            [
                'name' => 'Benteler Arena Nebenplatz Paderborn',
                'address' => 'Benteler Str. 29',
                'city' => 'Paderborn',
                'lat' => 51.7036,
                'lng' => 8.7641,
                'capacity' => 3200
            ],
            // 26 SSV Jahn Regensburg
            [
                'name' => 'Continental Arena Nebenplatz Regensburg',
                'address' => 'Obertraublinger Str. 7',
                'city' => 'Regensburg',
                'lat' => 48.9875,
                'lng' => 12.1060,
                'capacity' => 3800
            ],
            // 27 SV Wehen Wiesbaden
            [
                'name' => 'BRITA-Arena Nebenplatz Wiesbaden',
                'address' => 'Werner-Heisenberg-Str. 1',
                'city' => 'Wiesbaden',
                'lat' => 50.0683,
                'lng' => 8.2385,
                'capacity' => 3400
            ],
            // 28 SSV Ulm 1846
            [
                'name' => 'Donaustadion Nebenplatz Ulm',
                'address' => 'Römerstr. 1',
                'city' => 'Ulm',
                'lat' => 48.3826,
                'lng' => 9.9890,
                'capacity' => 2800
            ],
            // 29 SC Preußen Münster
            [
                'name' => 'Preußenstadion Nebenplatz Münster',
                'address' => 'Georg-Wo-Str. 1',
                'city' => 'Münster',
                'lat' => 51.9508,
                'lng' => 7.6162,
                'capacity' => 3000
            ],
            // 30 SV Elversberg
            [
                'name' => 'Ursapharm-Arena Elversberg',
                'address' => 'Kaiserslauterer Str. 4',
                'city' => 'Elversberg',
                'lat' => 49.3378,
                'lng' => 7.1174,
                'capacity' => 5000
            ],
            // 31 Eintracht Braunschweig
            [
                'name' => 'Eintracht-Stadion Nebenplatz Braunschweig',
                'address' => 'Hamburger Str. 210',
                'city' => 'Braunschweig',
                'lat' => 52.2740,
                'lng' => 10.5250,
                'capacity' => 3000
            ],
            // 32 Dynamo Dresden
            [
                'name' => 'Rudolf-Harbig-Stadion Nebenplatz Dresden',
                'address' => 'Lennéstr. 12',
                'city' => 'Dresden',
                'lat' => 51.0492,
                'lng' => 13.7430,
                'capacity' => 4500
            ],
            // 33 Hallescher FC
            [
                'name' => 'Erdgas Sportpark Halle',
                'address' => 'Freiimfelder Str. 79',
                'city' => 'Halle (Saale)',
                'lat' => 51.5030,
                'lng' => 11.9450,
                'capacity' => 4500
            ],
            // 34 FC Energie Cottbus
            [
                'name' => 'Stadion der Freundschaft Cottbus',
                'address' => 'August-Bebel-Str. 1',
                'city' => 'Cottbus',
                'lat' => 51.7561,
                'lng' => 14.3282,
                'capacity' => 4800
            ],
            // 35 SV Waldhof Mannheim
            [
                'name' => 'Carl-Benz-Stadion Mannheim',
                'address' => 'Obere Riedstr. 1',
                'city' => 'Mannheim',
                'lat' => 49.4964,
                'lng' => 8.5174,
                'capacity' => 4900
            ],
            // 36 VfL Bochum 1848
            [
                'name' => 'Vonovia Ruhrstadion Nebenplatz Bochum',
                'address' => 'Castroper Str. 145',
                'city' => 'Bochum',
                'lat' => 51.4942,
                'lng' => 7.2366,
                'capacity' => 3500
            ],
            // 37 SV Darmstadt 98
            [
                'name' => 'Merck-Stadion Nebenplatz Darmstadt',
                'address' => 'Stadionweg 23',
                'city' => 'Darmstadt',
                'lat' => 49.8753,
                'lng' => 8.6459,
                'capacity' => 3200
            ],
            // 38 FC Heidenheim
            [
                'name' => 'Voith-Arena Nebenplatz Heidenheim',
                'address' => 'Schloßhaustr. 4',
                'city' => 'Heidenheim an der Brenz',
                'lat' => 48.6747,
                'lng' => 10.1523,
                'capacity' => 4000
            ],
            // 39 Rot-Weiß Essen
            [
                'name' => 'Stadion Essen',
                'address' => 'Hafenstr. 97a',
                'city' => 'Essen',
                'lat' => 51.4690,
                'lng' => 6.9866,
                'capacity' => 5800
            ],
            // 40 MSV Duisburg
            [
                'name' => 'Schauinsland-Reisen-Arena Nebenplatz Duisburg',
                'address' => 'Auf dem Damm 32',
                'city' => 'Duisburg',
                'lat' => 51.4337,
                'lng' => 6.7797,
                'capacity' => 3800
            ],
            // 41 1. FC Saarbrücken
            [
                'name' => 'Ludwigspark-Stadion Saarbrücken',
                'address' => 'Hermann-Neuberger-Str. 21',
                'city' => 'Saarbrücken',
                'lat' => 49.2297,
                'lng' => 6.9968,
                'capacity' => 4500
            ],
            // 42 Sportfreunde Siegen
            [
                'name' => 'Leimbachstadion Siegen',
                'address' => 'Am Leimbachstadion 1',
                'city' => 'Siegen',
                'lat' => 50.8748,
                'lng' => 8.0243,
                'capacity' => 3500
            ],
            // 43 Alemannia Aachen
            [
                'name' => 'Tivoli Nebenplatz Aachen',
                'address' => 'Alemannenweg 10',
                'city' => 'Aachen',
                'lat' => 50.7600,
                'lng' => 6.1101,
                'capacity' => 4800
            ],
            // 44 SC Verl
            [
                'name' => 'Sportanlage Heidewald Verl',
                'address' => 'Paderborner Str. 47',
                'city' => 'Verl',
                'lat' => 51.8842,
                'lng' => 8.5218,
                'capacity' => 3500
            ],
            // 45 Wuppertaler SV
            [
                'name' => 'Zoo-Stadion Wuppertal',
                'address' => 'Georg-Lucas-Str. 1',
                'city' => 'Wuppertal',
                'lat' => 51.2604,
                'lng' => 7.1528,
                'capacity' => 4500
            ],
            // 46 Holstein Kiel
            [
                'name' => 'Holstein-Stadion Nebenplatz Kiel',
                'address' => 'Westring 570',
                'city' => 'Kiel',
                'lat' => 54.3450,
                'lng' => 10.0950,
                'capacity' => 4000
            ],
            // 47 FC Rot-Weiß Koblenz
            [
                'name' => 'Sportpark Koblenz',
                'address' => 'Oberwerth 14',
                'city' => 'Koblenz',
                'lat' => 50.3576,
                'lng' => 7.5947,
                'capacity' => 3200
            ],
            // 48 VfB Oldenburg
            [
                'name' => 'Marschwegstadion Oldenburg',
                'address' => 'Marschwegstadion 1',
                'city' => 'Oldenburg',
                'lat' => 53.1370,
                'lng' => 8.1853,
                'capacity' => 3500
            ],
            // 49 FC Carl Zeiss Jena
            [
                'name' => 'Ernst-Abbe-Sportfeld Jena',
                'address' => 'Am Sportfeld 1',
                'city' => 'Jena',
                'lat' => 50.9246,
                'lng' => 11.5885,
                'capacity' => 4500
            ],
            // 50 FC Plauen
            [
                'name' => 'Vogtlandstadion Plauen',
                'address' => 'Kanzlerstr. 26',
                'city' => 'Plauen',
                'lat' => 50.4867,
                'lng' => 12.1315,
                'capacity' => 3200
            ],
            // 51 Babelsberg 03
            [
                'name' => 'Karl-Liebknecht-Stadion Potsdam',
                'address' => 'Karl-Liebknecht-Str. 118',
                'city' => 'Potsdam',
                'lat' => 52.3820,
                'lng' => 13.1053,
                'capacity' => 3000
            ],
            // 52 SV Sandhausen
            [
                'name' => 'Sportanlage Hardtwald Sandhausen',
                'address' => 'Untergrombacher Str. 2',
                'city' => 'Sandhausen',
                'lat' => 49.3473,
                'lng' => 8.6564,
                'capacity' => 3200
            ],
            // 53 SpVgg Unterhaching
            [
                'name' => 'Sportpark Unterhaching',
                'address' => 'Heinrich-Wieland-Str. 35',
                'city' => 'Unterhaching',
                'lat' => 48.0666,
                'lng' => 11.6166,
                'capacity' => 2500
            ],
            // 54 KFC Uerdingen 05
            [
                'name' => 'Sportanlage Grotenburg Krefeld',
                'address' => 'Grotenburg 40',
                'city' => 'Krefeld',
                'lat' => 51.3345,
                'lng' => 6.5793,
                'capacity' => 3100
            ],
            // 55 FC Erzgebirge Aue
            [
                'name' => 'Erzgebirgsstadion Aue',
                'address' => 'Fichtelbergstr. 83',
                'city' => 'Aue',
                'lat' => 50.5898,
                'lng' => 12.7032,
                'capacity' => 3800
            ],
            // 56 TSV 1860 München
            [
                'name' => 'Sportgelände Giesing München',
                'address' => 'Grünwalder Str. 114',
                'city' => 'München',
                'lat' => 48.1066,
                'lng' => 11.5766,
                'capacity' => 4200
            ],
            // 57 FC Bayern München II
            [
                'name' => 'Bayern Campus München',
                'address' => 'Werner-Heisenberg-Allee 25',
                'city' => 'München',
                'lat' => 48.2145,
                'lng' => 11.6268,
                'capacity' => 2500
            ],
            // 58 BVB Dortmund II
            [
                'name' => 'BVB Trainingsgelände Brackel',
                'address' => 'Am Ostpark 10',
                'city' => 'Dortmund',
                'lat' => 51.5190,
                'lng' => 7.5210,
                'capacity' => 1500
            ],
            // 59 Hamburger SV II
            [
                'name' => 'Hein-Lehmann-Weg Sportanlage Hamburg',
                'address' => 'Hein-Lehmann-Weg 30',
                'city' => 'Hamburg',
                'lat' => 53.5785,
                'lng' => 9.9042,
                'capacity' => 1800
            ],

            // ── Kleine Klubs (clubIdx 60–99) ─────────────────────────────────
            // 60 Eintracht Frankfurt II
            [
                'name' => 'Frankfurter Volksbank Stadion',
                'address' => 'Am Bornheimer Hang 1',
                'city' => 'Frankfurt am Main',
                'lat' => 50.1258,
                'lng' => 8.7014,
                'capacity' => 4100
            ],
            // 61 SV Türkgücü München
            [
                'name' => 'Sportanlage Unterföhring München',
                'address' => 'Feringastr. 17',
                'city' => 'Unterföhring',
                'lat' => 48.1975,
                'lng' => 11.6431,
                'capacity' => 2000
            ],
            // 62 SV Rödinghausen
            [
                'name' => 'Häcker Wiehenstadion Rödinghausen',
                'address' => 'Am Wiehenstadion 1',
                'city' => 'Rödinghausen',
                'lat' => 52.2465,
                'lng' => 8.4957,
                'capacity' => 4200
            ],
            // 63 Berliner AK 07
            [
                'name' => 'Mommsenstadion Berlin',
                'address' => 'Waldschulallee 34',
                'city' => 'Berlin',
                'lat' => 52.5050,
                'lng' => 13.2920,
                'capacity' => 3000
            ],
            // 64 FC Gütersloh
            [
                'name' => 'Heidewaldstadion Gütersloh',
                'address' => 'Am Heidewaldstadion 1',
                'city' => 'Gütersloh',
                'lat' => 51.9082,
                'lng' => 8.3842,
                'capacity' => 3500
            ],
            // 65 FC Viktoria Köln
            [
                'name' => 'Sportpark Höhenberg Köln',
                'address' => 'Rondorfer Str. 2',
                'city' => 'Köln',
                'lat' => 50.9215,
                'lng' => 7.0290,
                'capacity' => 4500
            ],
            // 66 Fortuna Köln
            [
                'name' => 'Südstadion Köln',
                'address' => 'Vorgebirgsstr. 100a',
                'city' => 'Köln',
                'lat' => 50.9101,
                'lng' => 6.9449,
                'capacity' => 3500
            ],
            // 67 SG Wattenscheid 09
            [
                'name' => 'Lohrheidestadion Wattenscheid',
                'address' => 'Lohrheide 1',
                'city' => 'Bochum',
                'lat' => 51.4779,
                'lng' => 7.1476,
                'capacity' => 4500
            ],
            // 68 TuS Koblenz
            [
                'name' => 'Stadion Oberwerth Koblenz',
                'address' => 'Oberwerth 1',
                'city' => 'Koblenz',
                'lat' => 50.3541,
                'lng' => 7.5916,
                'capacity' => 3200
            ],
            // 69 SpVgg Bayreuth
            [
                'name' => 'Hans-Walter-Wild-Stadion Bayreuth',
                'address' => 'Birkenstr. 43',
                'city' => 'Bayreuth',
                'lat' => 49.9476,
                'lng' => 11.5795,
                'capacity' => 5500
            ],
            // 70 Würzburger Kickers
            [
                'name' => 'FC Würzburger Kickers Sportanlage',
                'address' => 'Steigerwaldstr. 21',
                'city' => 'Würzburg',
                'lat' => 49.7883,
                'lng' => 9.9402,
                'capacity' => 4700
            ],
            // 71 FC Schweinfurt 05
            [
                'name' => 'Willy-Sachs-Stadion Schweinfurt',
                'address' => 'Masbacher Str. 1',
                'city' => 'Schweinfurt',
                'lat' => 50.0473,
                'lng' => 10.2201,
                'capacity' => 5800
            ],
            // 72 VfR Aalen
            [
                'name' => 'Scholz Arena Aalen',
                'address' => 'Jahnstr. 12',
                'city' => 'Aalen',
                'lat' => 48.8284,
                'lng' => 10.0919,
                'capacity' => 8532
            ],
            // 73 Stuttgarter Kickers
            [
                'name' => 'Gazi-Stadion auf der Waldau Stuttgart',
                'address' => 'Richard-Wagner-Str. 5',
                'city' => 'Stuttgart',
                'lat' => 48.7572,
                'lng' => 9.2034,
                'capacity' => 3500
            ],
            // 74 VfV Hildesheim
            [
                'name' => 'Hildesheimer Sportanlage Nord',
                'address' => 'Bischofskamp 4',
                'city' => 'Hildesheim',
                'lat' => 52.1619,
                'lng' => 9.9429,
                'capacity' => 1500
            ],
            // 75 TSV Havelse
            [
                'name' => 'Sportanlage Havelse Garbsen',
                'address' => 'Am Bögelsweg 11',
                'city' => 'Garbsen',
                'lat' => 52.4012,
                'lng' => 9.5851,
                'capacity' => 2500
            ],
            // 76 Eintracht Celle FC
            [
                'name' => 'Sportzentrum Celle',
                'address' => 'Im Waldgarten 12',
                'city' => 'Celle',
                'lat' => 52.6256,
                'lng' => 10.0820,
                'capacity' => 2000
            ],
            // 77 SV Atlas Delmenhorst
            [
                'name' => 'Sportanlage Düsternort Delmenhorst',
                'address' => 'Düsternortstr. 35',
                'city' => 'Delmenhorst',
                'lat' => 53.0456,
                'lng' => 8.6282,
                'capacity' => 2500
            ],
            // 78 SV Sparta Lichtenberg
            [
                'name' => 'Sportanlage Lichtenberg Berlin',
                'address' => 'Alt-Biesdorf 53',
                'city' => 'Berlin',
                'lat' => 52.5096,
                'lng' => 13.5537,
                'capacity' => 1500
            ],
            // 79 VfV Borussia 06 Hildesheim
            [
                'name' => 'Stadion am Bischofskamp Hildesheim',
                'address' => 'Bischofskamp 1',
                'city' => 'Hildesheim',
                'lat' => 52.1621,
                'lng' => 9.9435,
                'capacity' => 1800
            ],
            // 80 TuS RW Koblenz
            [
                'name' => 'Maifeld-Sportzentrum Koblenz',
                'address' => 'August-Horch-Str. 3',
                'city' => 'Koblenz',
                'lat' => 50.3668,
                'lng' => 7.5887,
                'capacity' => 2000
            ],
            // 81 FC Astoria Walldorf
            [
                'name' => 'Sportclub-Arena Walldorf',
                'address' => 'Am Fischbächel 3',
                'city' => 'Walldorf',
                'lat' => 49.3060,
                'lng' => 8.6462,
                'capacity' => 3000
            ],
            // 82 FC Homburg
            [
                'name' => 'Waldstadion Homburg',
                'address' => 'Waldstadion 1',
                'city' => 'Homburg',
                'lat' => 49.3257,
                'lng' => 7.3367,
                'capacity' => 4800
            ],
            // 83 SV Gonsenheim
            [
                'name' => 'Sportgelände Gonsenheim Mainz',
                'address' => 'Werner-Heisenberg-Str. 1',
                'city' => 'Mainz',
                'lat' => 49.9980,
                'lng' => 8.2357,
                'capacity' => 1500
            ],
            // 84 Sportfreunde Eisbachtal
            [
                'name' => 'Sportanlage Eisbachtal Steinebach',
                'address' => 'Im Eisbachtal 1',
                'city' => 'Steinebach (Wied)',
                'lat' => 50.5691,
                'lng' => 7.6344,
                'capacity' => 800
            ],
            // 85 FC Trier
            [
                'name' => 'Moselstadion Trier',
                'address' => 'Im Moselstadion 1',
                'city' => 'Trier',
                'lat' => 49.7572,
                'lng' => 6.6472,
                'capacity' => 4500
            ],
            // 86 FK Pirmasens
            [
                'name' => 'Sportpark Pirmasens',
                'address' => 'Horeb 1',
                'city' => 'Pirmasens',
                'lat' => 49.2034,
                'lng' => 7.6056,
                'capacity' => 3500
            ],
            // 87 TuS Mechtersheim
            [
                'name' => 'Sportanlage Mechtersheim',
                'address' => 'Sportplatzstr. 5',
                'city' => 'Römerberg',
                'lat' => 49.3472,
                'lng' => 8.3726,
                'capacity' => 1200
            ],
            // 88 FC Deidesheim
            [
                'name' => 'Sportanlage Deidesheim',
                'address' => 'Am Sportplatz 1',
                'city' => 'Deidesheim',
                'lat' => 49.4102,
                'lng' => 8.1730,
                'capacity' => 800
            ],
            // 89 SG Rehborn
            [
                'name' => 'Sportplatz Rehborn',
                'address' => 'Hauptstr. 50',
                'city' => 'Rehborn',
                'lat' => 49.7650,
                'lng' => 7.6250,
                'capacity' => 500
            ],
            // 90 VfB Bodenheim
            [
                'name' => 'Sportanlage Bodenheim',
                'address' => 'Sportplatzweg 3',
                'city' => 'Bodenheim',
                'lat' => 49.9269,
                'lng' => 8.3099,
                'capacity' => 700
            ],
            // 91 SC 07 Idar-Oberstein
            [
                'name' => 'Felsenstadion Idar-Oberstein',
                'address' => 'Felsenstadionstr. 1',
                'city' => 'Idar-Oberstein',
                'lat' => 49.7128,
                'lng' => 7.3218,
                'capacity' => 2800
            ],
            // 92 SSV Ulm 1846 II
            [
                'name' => 'Donauwiese Trainingsgelände Ulm',
                'address' => 'Am Sportplatz 2',
                'city' => 'Ulm',
                'lat' => 48.3801,
                'lng' => 9.9840,
                'capacity' => 1200
            ],
            // 93 SV Sandhausen II
            [
                'name' => 'Waldstadion Nebenplatz Sandhausen',
                'address' => 'Untergrombacher Str. 4',
                'city' => 'Sandhausen',
                'lat' => 49.3470,
                'lng' => 8.6570,
                'capacity' => 800
            ],
            // 94 VfB Lübeck
            [
                'name' => 'Lohmühle Stadion Lübeck',
                'address' => 'Lohmühle 1',
                'city' => 'Lübeck',
                'lat' => 53.8666,
                'lng' => 10.6873,
                'capacity' => 4800
            ],
            // 95 SC Teutonia 05
            [
                'name' => 'Sportanlage Hoheluft Hamburg',
                'address' => 'Hoheluftchaussee 10',
                'city' => 'Hamburg',
                'lat' => 53.5823,
                'lng' => 9.9718,
                'capacity' => 2200
            ],
            // 96 TSV Schott Mainz
            [
                'name' => 'Sportpark Schott Mainz',
                'address' => 'Carl-Zeiss-Str. 2',
                'city' => 'Mainz',
                'lat' => 49.9856,
                'lng' => 8.2693,
                'capacity' => 2000
            ],
            // 97 Rot-Weiss Ahlen
            [
                'name' => 'Wersestadion Ahlen',
                'address' => 'Am Wersestadion 1',
                'city' => 'Ahlen',
                'lat' => 51.7632,
                'lng' => 7.8936,
                'capacity' => 6500
            ],
            // 98 VfB Homberg
            [
                'name' => 'Sportanlage Homberg Duisburg',
                'address' => 'An der Alten Rheinbrücke 1',
                'city' => 'Duisburg',
                'lat' => 51.4500,
                'lng' => 6.7300,
                'capacity' => 3000
            ],
            // 99 SC Union Nettetal
            [
                'name' => 'Sportpark Nettetal',
                'address' => 'Am Sportpark 5',
                'city' => 'Nettetal',
                'lat' => 51.3156,
                'lng' => 6.2860,
                'capacity' => 1500
            ],
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
            $surfaceKey = $surfacePattern[$i % count($surfacePattern)];
            $location->setSurfaceType($surfaceTypes[$surfaceKey]);
            $manager->persist($location);
            $this->addReference('lt_location_' . $i, $location);
        }

        $manager->flush();
    }
}
