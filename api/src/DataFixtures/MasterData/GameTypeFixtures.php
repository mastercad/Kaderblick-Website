<?php

namespace App\DataFixtures\MasterData;

use App\Entity\GameType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class GameTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            // ── Liga ──────────────────────────────────────────────────────────
            [
                'name' => 'Ligaspiel',
                'description' => 'Reguläre Spiele in Ligen wie Bundesliga, Premier League etc.'
            ],
            [
                'name' => 'Nachholspiel',
                'description' => 'Verschobene oder nachgeholte Ligaspiele.'
            ],

            // ── Pokal ─────────────────────────────────────────────────────────
            [
                'name' => 'Pokalspiel',
                'description' => 'Spiele in Pokalwettbewerben. Rundenbezeichnung (z.B. "Halbfinale") separat im Feld "Runde" eintragen.'
            ],

            // ── Test / Freundschaft ───────────────────────────────────────────
            [
                'name' => 'Freundschaftsspiel',
                'description' => 'Testspiele und Vorbereitungsspiele ohne Wettbewerbscharakter.'
            ],
            [
                'name' => 'Testspiel',
                'description' => 'Ähnlich wie Freundschaftsspiele, aber mit mehr Experimentiercharakter.'
            ],

            // ── Turnier ───────────────────────────────────────────────────────
            [
                'name' => 'Turnierspiel',
                'description' => 'Allgemeines Spiel in einem Turnier.'
            ],
            [
                'name' => 'Hallenturnier',
                'description' => 'Spiel in einem Hallenturnier (Hallensaison).'
            ],
            [
                'name' => 'Pokalturnier',
                'description' => 'Spiel in einem Pokalturnier (z.B. Kreispokal-Turnier).'
            ],
            [
                'name' => 'Saisonturnier',
                'description' => 'Spiel in einem Saisonturnier (z.B. Saisoneröffnungsturnier).'
            ],

            // ── Sonstiges ─────────────────────────────────────────────────────
            [
                'name' => 'Internationales Spiel',
                'description' => 'Länderspiele und Nations League Spiele.'
            ],
            [
                'name' => 'Supercup',
                'description' => 'Spiele wie DFL-Supercup oder FA Community Shield.'
            ],
            [
                'name' => 'Playoff-Spiel',
                'description' => 'Spiele in Aufstiegsrunden oder Relegation.'
            ],
            [
                'name' => 'Trainingseinheit',
                'description' => 'Interne Trainingsspiele und -einheiten.'
            ],
            [
                'name' => 'Internes Spiel',
                'description' => 'Vereinsinterne Spiele, z.B. zwischen zwei Mannschaften desselben Vereins.'
            ],
            [
                'name' => 'Qualifikationsspiel',
                'description' => 'Spiele zur Qualifikation für Turniere oder Ligen.'
            ],
            [
                'name' => 'Vorrundenspiel',
                'description' => 'Gruppenspiele bei Turnieren.'
            ],

            // ── System (nicht für manuelle Auswahl) ───────────────────────────
            [
                'name' => 'Turnier-Match',
                'description' => 'Automatisch erzeugte Spiele für Turnier-Matches. Nicht für manuelle Auswahl.'
            ],
        ];

        foreach ($types as $type) {
            $existing = $manager->getRepository(GameType::class)->findOneBy([
                'name' => $type['name'],
            ]);
            if ($existing) {
                $gameType = $existing;
            } else {
                $gameType = new GameType();
                $gameType->setName($type['name']);
                $gameType->setDescription($type['description']);
                $manager->persist($gameType);
            }

            $this->addReference(
                'game_type_' . strtolower(str_replace(['-', ' '], '_', $gameType->getName())),
                $gameType
            );
        }

        $manager->flush();
        $manager->clear();
    }
}
