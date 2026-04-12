<?php

namespace App\DataFixtures\DemoData;

use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Demo-Fixtures: ~10 repräsentative Benutzer pro Verein.
 *
 * Pro Verein:
 *   localIdx 0 → Vereinsadmin (ROLE_CLUB)
 *   localIdx 1 → Cheftrainer-Account (linked über UserRelationFixtures)
 *   localIdx 2 → Co-Trainer-Account  (linked über UserRelationFixtures)
 *   localIdx 3-8 → Spieler-Accounts   (linked über UserRelationFixtures)
 *   localIdx 9 → Elternteil-Account   (linked über UserRelationFixtures)
 *
 * Referenzschlüssel: demo_user_{clubIdx}_{localIdx}
 * Login-Passwort (alle): DemoPass1!
 * Gruppe: demo
 */
class UserFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const DEMO_PASSWORD = 'DemoPass1!';

    /** Club slug für vorhersagbare E-Mail-Adressen. */
    private const CLUB_SLUGS = [
        0 => 'sonnenberg',
        1 => 'waldkirchen',
        2 => 'bergheim',
        3 => 'rosenbach',
        4 => 'mittelstadt',
        5 => 'rotbach',
        6 => 'langental',
        7 => 'gruenhoehe',
        8 => 'birkenau',
        9 => 'weissach',
    ];

    /** Vorname + Nachname pro (clubIdx, localIdx).
     *  Indizes 0=Admin, 1=Trainer1, 2=Trainer2, 3-8=Spieler, 9=Elternteil */
    private const USER_NAMES = [
        0 => [
            ['Julian',  'Berger'],   // 0 admin
            ['Markus',  'Berger'],   // 1 trainer1 (identisch mit CoachFixtures[0])
            ['Stefan',  'Gruber'],   // 2 trainer2
            ['Kevin',   'Sonnauer'], // 3 spieler1
            ['Patrick', 'Hess'],     // 4 spieler2
            ['Dominik', 'Baier'],    // 5 spieler3
            ['Florian', 'Seitz'],    // 6 spieler4
            ['Sven',    'Lindner'],  // 7 spieler5
            ['Matthias', 'Blum'],     // 8 spieler6
            ['Sabine',  'Hess'],     // 9 elternteil
        ],
        1 => [
            ['Werner',  'Waldner'],
            ['Andreas', 'Hofer'],
            ['Jürgen',  'Meier'],
            ['Lars',    'Buchner'],
            ['Nico',    'Walter'],
            ['Timo',    'Ernst'],
            ['Robert',  'Kober'],
            ['Philipp', 'Sander'],
            ['Marco',   'Voss'],
            ['Petra',   'Buchner'],
        ],
        2 => [
            ['Gerhard',  'Bergmann'],
            ['Klaus',    'Adler'],
            ['Peter',    'Fuchs'],
            ['Simon',    'Kramer'],
            ['Aaron',    'Winter'],
            ['Benedikt', 'Lang'],
            ['Jonas',    'Reich'],
            ['David',    'Scholz'],
            ['Luca',     'Stein'],
            ['Maria',    'Kramer'],
        ],
        3 => [
            ['Helmut',  'Rosenberg'],
            ['Bernd',   'Lanzinger'],
            ['Wolfgang', 'Glaser'],
            ['Robin',   'Schäfer'],
            ['Dennis',  'Graf'],
            ['Lukas',   'Braun'],
            ['Tim',     'Otto'],
            ['Felix',   'Ritter'],
            ['Jannik',  'Haas'],
            ['Karin',   'Schäfer'],
        ],
        4 => [
            ['Dieter',   'Brand'],
            ['Michael',  'Heck'],
            ['Carsten',  'Böhm'],
            ['Fabian',   'Siebert'],
            ['Kai',      'Engel'],
            ['Marcel',   'Noll'],
            ['Tobias',   'Zang'],
            ['Alexander', 'Beck'],
            ['Christian', 'Wolf'],
            ['Ute',      'Engel'],
        ],
        5 => [
            ['Klaus',  'Rothenbach'],
            ['Werner', 'Schell'],
            ['Gerd',   'Huber'],
            ['Oliver', 'Heinz'],
            ['Jan',    'Weiss'],
            ['Steffen', 'Fuchs'],
            ['Erik',   'Zorn'],
            ['Nils',   'Kurz'],
            ['Max',    'Voigt'],
            ['Eva',    'Huber'],
        ],
        6 => [
            ['Thomas',  'Langmann'],
            ['Harald',  'Baum'],
            ['Martin',  'Vogt'],
            ['Armin',   'Kiefer'],
            ['Samy',    'Özdemir'],
            ['Markus',  'Roth'],
            ['Leon',    'Frei'],
            ['Finn',    'Bauer'],
            ['Noah',    'Heim'],
            ['Lisa',    'Kiefer'],
        ],
        7 => [
            ['Frank',   'Grüneberg'],
            ['Ingo',    'Pfeiffer'],
            ['Roland',  'Zink'],
            ['Bastian', 'Kraus'],
            ['Emre',    'Yildiz'],
            ['Sascha',  'Wendt'],
            ['Moritz',  'Horn'],
            ['Stefan',  'Lauer'],
            ['Julian',  'Pohl'],
            ['Nicole',  'Yildiz'],
        ],
        8 => [
            ['Ernst',  'Birkenbach'],
            ['Norbert', 'Fröhlich'],
            ['Klaus',  'Mayer'],
            ['Colin',  'Steiner'],
            ['Elias',  'Krull'],
            ['Ben',    'Drews'],
            ['Paul',   'Sack'],
            ['Finn',   'Herr'],
            ['Luca',   'Baur'],
            ['Monika', 'Steiner'],
        ],
        9 => [
            ['Friedrich', 'Weissbach'],
            ['Helmut',   'Siebert'],
            ['Hermann',  'Bach'],
            ['Mats',     'Kroll'],
            ['Elia',     'Schön'],
            ['Gabriel',  'Dorn'],
            ['Owen',     'Kirsch'],
            ['Milan',    'Renz'],
            ['Adam',     'Frey'],
            ['Brigitte', 'Kroll'],
        ],
    ];

    public function __construct(
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            ClubFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        $adminEmail = 'admin.sonnenberg@demo-kaderblick.de';
        $existingAdmin = $manager->getRepository(User::class)->findOneBy(['email' => $adminEmail]);

        if ($existingAdmin) {
            // Re-register references only
            foreach (self::USER_NAMES as $clubIdx => $users) {
                $slug = self::CLUB_SLUGS[$clubIdx];
                foreach ($users as $localIdx => $nameData) {
                    $email = $this->buildEmail($localIdx, $slug);
                    $u = $manager->getRepository(User::class)->findOneBy(['email' => $email]);
                    if ($u) {
                        $this->addReference('demo_user_' . $clubIdx . '_' . $localIdx, $u);
                    }
                }
            }

            return;
        }

        $batchSize = 50;
        $count = 0;

        foreach (self::USER_NAMES as $clubIdx => $users) {
            $slug = self::CLUB_SLUGS[$clubIdx];

            foreach ($users as $localIdx => [$firstName, $lastName]) {
                $email = $this->buildEmail($localIdx, $slug);

                $user = new User();
                $user->setEmail($email);
                $user->setFirstName($firstName);
                $user->setLastName($lastName);
                $user->setIsEnabled(true);
                $user->setIsVerified(true);

                match ($localIdx) {
                    0 => $user->addRole('ROLE_CLUB'),
                    1, 2 => $user->addRole('ROLE_USER'),
                    default => $user->addRole('ROLE_USER'),
                };

                $hashedPw = $this->passwordHasher->hashPassword($user, self::DEMO_PASSWORD);
                $user->setPassword($hashedPw);

                $manager->persist($user);
                $this->addReference('demo_user_' . $clubIdx . '_' . $localIdx, $user);

                if (0 === ++$count % $batchSize) {
                    $manager->flush();
                }
            }
        }

        $manager->flush();
    }

    private function buildEmail(int $localIdx, string $clubSlug): string
    {
        $prefix = match ($localIdx) {
            0 => 'admin',
            1 => 'trainer1',
            2 => 'trainer2',
            3, 4, 5, 6, 7, 8 => 'spieler' . ($localIdx - 2),
            9 => 'elternteil',
            default => 'user' . $localIdx,
        };

        return $prefix . '.' . $clubSlug . '@demo-kaderblick.de';
    }
}
