<?php

namespace App\DataFixtures\MasterData;

use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class UserFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master', 'demo'];
    }

    public function load(ObjectManager $manager): void
    {
        $existing = $manager->getRepository(User::class)->findOneBy([
            'email' => 'andreas.kempe@kaderblick.de',
        ]);
        if (!$existing) {
            $user = new User();
            $user->setEmail('andreas.kempe@kaderblick.de')
                ->setFirstName('Andreas')
                ->setLastName('Kempe')
                ->setRoles(['ROLE_SUPERADMIN'])
                ->setPassword('$2y$13$5M1HZSipUxTlL3oZ3rAojuXJgAIuMJf3iQe7MuKm1FWOeOsgAh4xS')
                ->setIsVerified(true)
                ->setIsEnabled(true);
            $manager->persist($user);
        }

        $manager->flush();
        $manager->clear();
    }
}
