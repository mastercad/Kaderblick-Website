<?php

namespace App\DataFixtures\MasterData;

use App\Entity\CupRound;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class CupRoundFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $names = [
            // Finale
            'Finale',
            'Kleines Finale',

            // Halbfinals
            'Halbfinale',

            // Viertelfinals
            'Viertelfinale',

            // Achtelfinals
            'Achtelfinale',

            // 16tel bis 256tel
            'Sechzehntelfinale',
            'Zweiunddreißigstelfinale',
            'Vierundneunzigstelfinale (128er-Runde)',
            '256er-Runde',

            // Nummerierte Runden
            '1. Runde',
            '2. Runde',
            '3. Runde',
            '4. Runde',
            '5. Runde',
            '6. Runde',

            // Gruppen- und Vorphasen
            'Gruppenphase',
            'Vorrunde',
            'Zwischenrunde',
            'Aufstiegsrunde',

            // Qualifikation / Relegation
            'Qualifikationsrunde',
            '1. Qualifikationsrunde',
            '2. Qualifikationsrunde',
            '3. Qualifikationsrunde',
            'Play-offs',
            'Relegation',

            // Supercup / Sonderrunden
            'Supercup',
            'Entscheidungsspiel',
            'Wiederholungsspiel',
        ];

        foreach ($names as $name) {
            $existing = $manager->getRepository(CupRound::class)->findOneBy([
                'name' => $name,
            ]);
            if ($existing) {
                continue;
            }

            $round = new CupRound();
            $round->setName($name);
            $manager->persist($round);
        }

        $manager->flush();
    }
}
