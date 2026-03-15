<?php

namespace App\DataFixtures\LoadTest;

use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Load-Test Fixtures: 601 Benutzer (1 Admin + 600 reguläre User verschiedener Rollen).
 * Referenz-Keys: lt_admin_user, lt_user_0 bis lt_user_599
 * Gruppe: load_test.
 */
class UserFixtures extends Fixture implements FixtureGroupInterface
{
    public function __construct(
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function load(ObjectManager $manager): void
    {
        $firstNames = [
            'Lukas', 'Max', 'Felix', 'Jonas', 'Leon', 'Erik', 'Niklas', 'Tim', 'Tobias', 'Sebastian',
            'David', 'Jan', 'Stefan', 'Michael', 'Andreas', 'Christian', 'Florian', 'Kevin', 'Patrick', 'Thomas',
            'Hannah', 'Laura', 'Lea', 'Anna', 'Sarah', 'Lisa', 'Julia', 'Sophie', 'Emma', 'Mia',
            'Finn', 'Noah', 'Elias', 'Ben', 'Luca', 'Paul', 'Moritz', 'Jannik', 'Marcel', 'Dominic',
        ];

        $lastNames = [
            'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
            'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Braun', 'Krüger', 'Werner',
            'Hartmann', 'Lange', 'Schmitt', 'König', 'Bauer', 'Zimmermann', 'Kramer', 'Huber', 'Friedrich', 'Maier',
            'Frank', 'Walter', 'Lehmann', 'Günter', 'Peters', 'Berger', 'Sommer', 'Weiß', 'Jung', 'Brandt',
        ];

        // Admin-Benutzer erstellen
        $adminEmail = 'lt.admin@kaderblick-loadtest.de';
        $adminUser = $manager->getRepository(User::class)->findOneBy(['email' => $adminEmail]);
        if (!$adminUser) {
            $adminUser = new User();
            $adminUser->setEmail($adminEmail);
            $adminUser->setFirstName('LoadTest');
            $adminUser->setLastName('Admin');
            $adminUser->addRole('ROLE_SUPERADMIN');
            $hashedPw = $this->passwordHasher->hashPassword($adminUser, 'loadtest123');
            $adminUser->setPassword($hashedPw);
            $adminUser->setIsEnabled(true);
            $adminUser->setIsVerified(true);
            $manager->persist($adminUser);
        }
        $this->addReference('lt_admin_user', $adminUser);

        $batchSize = 100;

        // 600 reguläre Benutzer
        for ($i = 0; $i < 600; ++$i) {
            $email = 'lt.user.' . $i . '@loadtest-example.de';
            $existing = $manager->getRepository(User::class)->findOneBy(['email' => $email]);
            if ($existing) {
                $this->addReference('lt_user_' . $i, $existing);
                continue;
            }

            $user = new User();
            $user->setEmail($email);
            $user->setFirstName($firstNames[$i % count($firstNames)]);
            $user->setLastName($lastNames[$i % count($lastNames)] . ($i > 39 ? ' ' . ($i + 1) : ''));

            // Rollenverteilung
            if ($i < 400) {
                // Users 0-399: reguläre Nutzer (Spieler-Accounts, Eltern)
                $user->addRole('ROLE_USER');
                $user->setIsVerified(true);
            } elseif ($i < 500) {
                // Users 400-499: Trainer-Accounts
                $user->addRole('ROLE_USER');
                $user->setIsVerified(true);
            } elseif ($i < 550) {
                // Users 500-549: Klub-Admins
                $user->addRole('ROLE_CLUB');
                $user->setIsVerified(true);
            } else {
                // Users 550-599: Vereins-Admins
                $user->addRole('ROLE_ADMIN');
                $user->setIsVerified(true);
            }

            $hashedPw = $this->passwordHasher->hashPassword($user, 'loadtest123');
            $user->setPassword($hashedPw);
            $user->setIsEnabled(true);

            $manager->persist($user);
            $this->addReference('lt_user_' . $i, $user);

            if (($i + 1) % $batchSize === 0) {
                $manager->flush();
            }
        }

        $manager->flush();
    }
}
