<?php

namespace App\DataFixtures\MasterData;

use App\Entity\PenaltyType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class PenaltyTypeFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $types = [
            ['name' => 'Verspätung', 'amount' => 5.00, 'isPositive' => false, 'description' => 'Verspätung zum Training oder Spiel'],
            ['name' => 'Unentschuldigtes Fehlen', 'amount' => 10.00, 'isPositive' => false, 'description' => 'Fehlen ohne vorherige Absage'],
            ['name' => 'Gelbe Karte', 'amount' => 5.00, 'isPositive' => false, 'description' => 'Gelbe Karte im Spiel'],
            ['name' => 'Rote Karte', 'amount' => 10.00, 'isPositive' => false, 'description' => 'Rote Karte im Spiel'],
            ['name' => 'Nicht abgesagte Teilnahme', 'amount' => 5.00, 'isPositive' => false, 'description' => 'Keine Rückmeldung zur Teilnahme'],
            ['name' => 'Handyklingeln', 'amount' => 2.00, 'isPositive' => false, 'description' => 'Handy klingelt in der Kabine'],
            ['name' => 'Trainingsteilnahme', 'amount' => 0.20, 'isPositive' => true, 'description' => 'Gutschrift für Trainingsbesuch'],
            ['name' => 'Spielteilnahme', 'amount' => 0.50, 'isPositive' => true, 'description' => 'Gutschrift für Spielteilnahme'],
            ['name' => 'Tor des Monats', 'amount' => 5.00, 'isPositive' => true, 'description' => 'Belohnung für das Tor des Monats'],
        ];

        foreach ($types as $data) {
            $existing = $manager->getRepository(PenaltyType::class)->findOneBy(['name' => $data['name']]);
            if (!$existing) {
                $type = new PenaltyType();
                $type->setName($data['name']);
                $type->setAmount($data['amount']);
                $type->setPositive($data['isPositive']);
                $type->setDescription($data['description']);
                $manager->persist($type);
            }
        }

        $manager->flush();
    }
}
