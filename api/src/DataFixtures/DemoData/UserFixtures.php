<?php

namespace App\DataFixtures\DemoData;

use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Demo-Fixtures: ~10 repräsentative Benutzer pro Verein + 1 Admin-User pro Verein.
 *
 * Pro Verein:
 *   localIdx 0 → Vereinsadmin (ROLE_CLUB), E-Mail: admin.{slug}@demo-kaderblick.de
 *   localIdx 1 → Cheftrainer-Account (ROLE_USER, linked über UserRelationFixtures)
 *   localIdx 2 → Co-Trainer-Account  (ROLE_USER, linked über UserRelationFixtures)
 *   localIdx 3-8 → Spieler-Accounts  (ROLE_USER, linked über UserRelationFixtures)
 *   localIdx 9 → Elternteil-Account  (ROLE_USER, linked über UserRelationFixtures)
 *   admin      → Plattform-Admin     (ROLE_ADMIN),     E-Mail: superadmin.{slug}@demo-kaderblick.de
 *   supporter  → Supporter           (ROLE_SUPPORTER), E-Mail: supporter.{slug}@demo-kaderblick.de
 *
 * Referenzschlüssel: demo_user_{clubIdx}_{localIdx}, demo_admin_{clubIdx}, demo_supporter_{clubIdx}
 * Login-Passwort (alle): DemoPass1!
 * Gruppe: demo
 *
 * Idempotent: bestehende User werden per Upsert aktualisiert (Rollen werden immer gesetzt).
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
        $repo = $manager->getRepository(User::class);
        $batchSize = 50;
        $count = 0;

        // --- Club + regular users (localIdx 0–9) ---
        foreach (self::USER_NAMES as $clubIdx => $users) {
            $slug = self::CLUB_SLUGS[$clubIdx];

            foreach ($users as $localIdx => [$firstName, $lastName]) {
                $email = $this->buildEmail($localIdx, $slug);

                $user = $repo->findOneBy(['email' => $email]) ?? new User();
                $user->setEmail($email);
                $user->setFirstName($firstName);
                $user->setLastName($lastName);
                $user->setIsEnabled(true);
                $user->setIsVerified(true);

                $role = (0 === $localIdx) ? 'ROLE_CLUB' : 'ROLE_USER';
                $user->setRoles([$role]);

                if (!$user->getPassword()) {
                    $user->setPassword($this->passwordHasher->hashPassword($user, self::DEMO_PASSWORD));
                }

                $manager->persist($user);
                $this->addReference('demo_user_' . $clubIdx . '_' . $localIdx, $user);

                if (0 === ++$count % $batchSize) {
                    $manager->flush();
                }
            }
        }

        // --- Admin users (one per club, ROLE_ADMIN) ---
        foreach (self::CLUB_SLUGS as $clubIdx => $slug) {
            $email = 'superadmin.' . $slug . '@demo-kaderblick.de';

            $user = $repo->findOneBy(['email' => $email]) ?? new User();
            $user->setEmail($email);

            [$firstName, $lastName] = self::USER_NAMES[$clubIdx][0];
            $user->setFirstName('Admin-' . $firstName);
            $user->setLastName($lastName);
            $user->setIsEnabled(true);
            $user->setIsVerified(true);
            $user->setRoles(['ROLE_ADMIN']);

            if (!$user->getPassword()) {
                $user->setPassword($this->passwordHasher->hashPassword($user, self::DEMO_PASSWORD));
            }

            $manager->persist($user);
            $this->addReference('demo_admin_' . $clubIdx, $user);

            if (0 === ++$count % $batchSize) {
                $manager->flush();
            }
        }

        // --- Supporter users (one per club, ROLE_SUPPORTER) ---
        foreach (self::CLUB_SLUGS as $clubIdx => $slug) {
            $email = 'supporter.' . $slug . '@demo-kaderblick.de';

            $user = $repo->findOneBy(['email' => $email]) ?? new User();
            $user->setEmail($email);

            [$firstName, $lastName] = self::USER_NAMES[$clubIdx][1];
            $user->setFirstName('Support-' . $firstName);
            $user->setLastName($lastName);
            $user->setIsEnabled(true);
            $user->setIsVerified(true);
            $user->setRoles(['ROLE_SUPPORTER']);

            if (!$user->getPassword()) {
                $user->setPassword($this->passwordHasher->hashPassword($user, self::DEMO_PASSWORD));
            }

            $manager->persist($user);
            $this->addReference('demo_supporter_' . $clubIdx, $user);

            if (0 === ++$count % $batchSize) {
                $manager->flush();
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
