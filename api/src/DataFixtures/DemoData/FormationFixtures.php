<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Formation;
use App\Entity\FormationType;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

/**
 * Demo-Fixtures: Aufstellungen für die Cheftrainer der 10 Senioren-I-Teams.
 *
 * Pro Club:
 * - "4-3-3 Konter" – klassisches Kontersystem
 * - "4-4-2 Defensiv" – defensiv orientiertes 4-4-2
 *
 * Spieler sind Platzhalter (isRealPlayer: false) ohne echte Spieler-IDs.
 *
 * Gruppe: demo
 */
class FormationFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    /**
     * Standard-Positionen für 4-3-3 (x%, y% auf Spielfeldhälfte von unten).
     * y=90 = eigenes Tor, y=10 = gegnerisches Tor.
     *
     * @var array<int, array{pos: string, x: float, y: float, number: int}>
     */
    private const PLAYERS_4_3_3 = [
        ['pos' => 'TW',  'x' => 50.0, 'y' => 88.0, 'number' => 1],
        ['pos' => 'LA',  'x' => 15.0, 'y' => 72.0, 'number' => 3],
        ['pos' => 'IV',  'x' => 35.0, 'y' => 76.0, 'number' => 4],
        ['pos' => 'IV',  'x' => 65.0, 'y' => 76.0, 'number' => 5],
        ['pos' => 'RA',  'x' => 85.0, 'y' => 72.0, 'number' => 2],
        ['pos' => 'LM',  'x' => 22.0, 'y' => 52.0, 'number' => 6],
        ['pos' => 'ZM',  'x' => 50.0, 'y' => 48.0, 'number' => 8],
        ['pos' => 'RM',  'x' => 78.0, 'y' => 52.0, 'number' => 7],
        ['pos' => 'LA',  'x' => 18.0, 'y' => 22.0, 'number' => 11],
        ['pos' => 'ST',  'x' => 50.0, 'y' => 14.0, 'number' => 9],
        ['pos' => 'RA',  'x' => 82.0, 'y' => 22.0, 'number' => 10],
    ];

    /**
     * Standard-Positionen für 4-4-2 (x%, y%).
     *
     * @var array<int, array{pos: string, x: float, y: float, number: int}>
     */
    private const PLAYERS_4_4_2 = [
        ['pos' => 'TW',  'x' => 50.0, 'y' => 88.0, 'number' => 1],
        ['pos' => 'LA',  'x' => 15.0, 'y' => 72.0, 'number' => 3],
        ['pos' => 'IV',  'x' => 35.0, 'y' => 76.0, 'number' => 4],
        ['pos' => 'IV',  'x' => 65.0, 'y' => 76.0, 'number' => 5],
        ['pos' => 'RA',  'x' => 85.0, 'y' => 72.0, 'number' => 2],
        ['pos' => 'LM',  'x' => 15.0, 'y' => 50.0, 'number' => 6],
        ['pos' => 'ZM',  'x' => 37.0, 'y' => 50.0, 'number' => 8],
        ['pos' => 'ZM',  'x' => 63.0, 'y' => 50.0, 'number' => 10],
        ['pos' => 'RM',  'x' => 85.0, 'y' => 50.0, 'number' => 7],
        ['pos' => 'ST',  'x' => 35.0, 'y' => 18.0, 'number' => 9],
        ['pos' => 'ST',  'x' => 65.0, 'y' => 18.0, 'number' => 11],
    ];

    /** @var array<int, array{name: string, code: string, players: array<int, array{pos: string, x: float, y: float, number: int}>, notes: string}> */
    private const FORMATION_TEMPLATES = [
        [
            'name' => '4-3-3 Konter',
            'code' => '4-3-3',
            'players' => self::PLAYERS_4_3_3,
            'notes' => 'Schnelles Umschalten nach Ballgewinn. Außenstürmer bleiben breit, Stürmer bleibt vorne.',
        ],
        [
            'name' => '4-4-2 Defensiv',
            'code' => '4-4-2',
            'players' => self::PLAYERS_4_4_2,
            'notes' => 'Kompaktes Mittelfeld. Beide Stürmer pressen früh. Mittelfeldspieler schieben eng zusammen.',
        ],
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            UserFixtures::class,
            \App\DataFixtures\MasterData\FormationTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        // Idempotenz
        $existing = $manager->getRepository(Formation::class)->findOneBy([]);
        if (null !== $existing) {
            return;
        }

        // FormationType 'fußball' aus DB laden
        $footballType = $manager->getRepository(FormationType::class)->findOneBy(['name' => 'fußball']);
        if (null === $footballType) {
            throw new RuntimeException("FormationType 'fußball' nicht gefunden. MasterData zuerst laden.");
        }

        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            // Formation gehört dem Cheftrainer (localIdx 1)
            /** @var User $trainerUser */
            $trainerUser = $this->getReference("demo_user_{$clubIdx}_1", User::class);

            foreach (self::FORMATION_TEMPLATES as $template) {
                $players = array_map(
                    static fn (int $i, array $p): array => [
                        'id' => $i + 1,
                        'x' => $p['x'],
                        'y' => $p['y'],
                        'number' => (string) $p['number'],
                        'name' => $p['pos'] . ' ' . ($i + 1),
                        'position' => $p['pos'],
                        'playerId' => null,
                        'isRealPlayer' => false,
                    ],
                    array_keys($template['players']),
                    $template['players']
                );

                // 3 Ersatzspieler auf der Bank
                $bench = [];
                for ($b = 12; $b <= 14; ++$b) {
                    $bench[] = [
                        'id' => $b,
                        'x' => 0.0,
                        'y' => 0.0,
                        'number' => (string) $b,
                        'name' => 'Ersatzspieler ' . $b,
                        'position' => 'ST',
                        'playerId' => null,
                        'isRealPlayer' => false,
                    ];
                }

                $formation = new Formation();
                $formation->setName($template['name']);
                $formation->setFormationType($footballType);
                $formation->setUser($trainerUser);
                $formation->setFormationData([
                    'code' => $template['code'],
                    'players' => $players,
                    'bench' => $bench,
                    'notes' => $template['notes'],
                ]);

                $manager->persist($formation);
            }
        }

        $manager->flush();
    }
}
