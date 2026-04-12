<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Club;
use App\Entity\News;
use App\Entity\Team;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Demo-Fixtures: Vereins- und Teamnachrichten für 3 Saisons.
 *
 * Pro Club und Saison:
 * - 2 Vereinsnachrichten (visibility: club)
 * - 1 Teamnachricht für Senioren I (visibility: team)
 *
 * Gesamt: 10 Clubs × 3 Saisons × 3 News = 90 Artikel
 *
 * Gruppe: demo
 */
class NewsFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    /** Senioren I team indices (aus TeamFixtures) für alle 10 Clubs. */
    private const SENIOREN_I_TEAM_IDXS = [0, 9, 16, 21, 26, 31, 35, 39, 43, 46];

    /**
     * Saison-Konfiguration.
     *
     * @var array<int, array{label: string, startYear: int, dates: array{club1: string, club2: string, team: string}}>
     */
    private const SEASONS = [
        [
            'label' => '2023/24',
            'startYear' => 2023,
            'dates' => ['club1' => '2023-07-14', 'club2' => '2024-01-12', 'team' => '2023-08-05'],
        ],
        [
            'label' => '2024/25',
            'startYear' => 2024,
            'dates' => ['club1' => '2024-07-13', 'club2' => '2025-01-11', 'team' => '2024-08-03'],
        ],
        [
            'label' => '2025/26',
            'startYear' => 2025,
            'dates' => ['club1' => '2025-07-12', 'club2' => '2025-11-08', 'team' => '2025-08-09'],
        ],
    ];

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            ClubFixtures::class,
            TeamFixtures::class,
            UserFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        // Idempotenz
        $existing = $manager->getRepository(News::class)->findOneBy([]);
        if (null !== $existing) {
            return;
        }

        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            /** @var Club $club */
            $club = $this->getReference("demo_club_{$clubIdx}", Club::class);
            /** @var Team $seniorenITeam */
            $seniorenITeam = $this->getReference(
                'demo_team_' . self::SENIOREN_I_TEAM_IDXS[$clubIdx],
                Team::class
            );
            /** @var User $adminUser */
            $adminUser = $this->getReference("demo_user_{$clubIdx}_0", User::class);

            $clubName = $club->getName();

            foreach (self::SEASONS as $season) {
                $label = $season['label'];
                $startYear = $season['startYear'];
                $nextYear = $startYear + 1;

                // ── Club-News 1: Saisonauftakt ───────────────────────────────
                $n1 = new News();
                $n1->setTitle("Saisonauftakt {$label} – Herzlich willkommen!");
                $n1->setContent(
                    "Der {$clubName} startet in die Saison {$label}!\n\n" .
                    'Der Kader wurde in der Sommerpause verstärkt, die Vorbereitung verlief positiv und die Mannschaft ist heiß auf die neue Saison. ' .
                    "Der Trainerstab hat intensiv an der Taktik gearbeitet und alle Spieler sind fit und motiviert.\n\n" .
                    "Die Ziele für die Saison {$label} sind klar definiert: eine starke Platzierung in der Kreisliga A und " .
                    "der Einzug in die nächste Kreispokalrunde. Wir freuen uns auf eure Unterstützung!\n\n" .
                    'Kommt zahlreich zu den Heimspielen – gemeinsam sind wir stärker!'
                );
                $n1->setVisibility('club');
                $n1->setClub($club);
                $n1->setCreatedBy($adminUser);
                $n1->setCreatedAt(new DateTimeImmutable($season['dates']['club1']));
                $manager->persist($n1);

                // ── Club-News 2: Saisonbilanz / Rückblick ───────────────────
                $isAutumn = 2025 === $season['startYear'];
                $midLabel = $isAutumn ? "Herbst {$startYear}" : "Hinrunde {$label}";
                $n2 = new News();
                $n2->setTitle("{$clubName}: Bilanz {$midLabel}");
                $n2->setContent(
                    "Die {$midLabel} der Saison {$label} ist abgeschlossen – Zeit für eine erste Bilanz!\n\n" .
                    "Unsere Senioren I haben bisher {$this->getPoints($clubIdx)} Punkte gesammelt und stehen gut da. " .
                    "Besonders erfreulich: die starke Defensive und die torgefährlichen Angriffe haben für Aufsehen gesorgt.\n\n" .
                    'In der Jugend sieht es ebenfalls gut aus: A- und B-Junioren entwickeln sich prächtig und ' .
                    "machen Lust auf mehr. Unser Nachwuchs ist die Zukunft des {$clubName}!\n\n" .
                    'Wir bedanken uns bei allen Sponsoren, Helfern und Fans für die tolle Unterstützung ' .
                    'und freuen uns auf die zweite Saisonhälfte!'
                );
                $n2->setVisibility('club');
                $n2->setClub($club);
                $n2->setCreatedBy($adminUser);
                $n2->setCreatedAt(new DateTimeImmutable($season['dates']['club2']));
                $manager->persist($n2);

                // ── Team-News: Senioren I Spielbericht / Update ──────────────
                $n3 = new News();
                $n3->setTitle("Senioren I: Vorbereitung auf die Saison {$label} abgeschlossen");
                $n3->setContent(
                    "Die Senioren I des {$clubName} haben die Vorbereitung für die Saison {$label} erfolgreich abgeschlossen.\n\n" .
                    'Trainer und Betreuerstab zeigen sich zufrieden mit dem Verlauf der Testspiele. ' .
                    "Drei Neuzugänge haben sich gut eingefügt und werden von Beginn an wichtige Rollen übernehmen.\n\n" .
                    'Das erste Pflichtspiel findet am ' . date('d.m.Y', strtotime('second Saturday of August ' . $startYear)) . ' statt. ' .
                    "Alle Spieler sind fit, die Vorfreude ist riesig!\n\n" .
                    'Treffpunkt: 1,5 Stunden vor Anpfiff am Vereinsheim. Bitte vollständige Ausrüstung mitbringen.'
                );
                $n3->setVisibility('team');
                $n3->setClub($club);
                $n3->setTeam($seniorenITeam);
                $n3->setCreatedBy($adminUser);
                $n3->setCreatedAt(new DateTimeImmutable($season['dates']['team']));
                $manager->persist($n3);
            }
        }

        $manager->flush();
    }

    /** Liefert eine vereinsspezifische Punktzahl für realistische Nachrichten-Texte. */
    private function getPoints(int $clubIdx): int
    {
        return [28, 22, 31, 19, 25, 17, 33, 20, 27, 23][$clubIdx] ?? 25;
    }
}
