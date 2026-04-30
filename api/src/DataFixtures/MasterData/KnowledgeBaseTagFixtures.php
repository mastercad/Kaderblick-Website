<?php

namespace App\DataFixtures\MasterData;

use App\Entity\KnowledgeBaseTag;
use App\Repository\KnowledgeBaseTagRepository;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class KnowledgeBaseTagFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $tags = [
            // Taktik
            'Pressing',
            'Gegenpressing',
            'Ballbesitz',
            'Konter',
            'Umschaltspiel',
            'Standards',
            'Eckbälle',
            'Freistöße',
            'Raumdeckung',
            'Manndeckung',
            'Offensivpressing',
            'Tiefstehend',

            // Formationen
            '4-3-3',
            '4-4-2',
            '3-5-2',
            '4-2-3-1',
            '5-3-2',

            // Training & Fitness
            'Aufwärmen',
            'Kraft',
            'Ausdauer',
            'Sprint',
            'Koordination',
            'Dehnen',
            'Regeneration',

            // Technik
            'Torschuss',
            'Dribbling',
            'Flanken',
            'Kopfball',
            'Passspiel',
            'Ballkontrolle',

            // Ernährung & Gesundheit
            'Ernährung',
            'Hydration',
            'Schlaf',
            'Verletzungsprävention',

            // Mental
            'Motivation',
            'Konzentration',
            'Teamgeist',
            'Führung',

            // Spielarten
            'Liga',
            'Pokal',
            'Testspiel',
            'Turnier',
        ];

        /** @var KnowledgeBaseTagRepository $repo */
        $repo = $manager->getRepository(KnowledgeBaseTag::class);

        foreach ($tags as $i => $name) {
            // Globale Tags (team = null) werden anhand des Namens identifiziert
            $tag = $repo->findOneBy(['name' => $name, 'team' => null]);

            if (null === $tag) {
                $tag = new KnowledgeBaseTag();
                $tag->setName($name);
                // team = null → globaler Tag (für alle Teams verfügbar)
                $manager->persist($tag);
            }

            $this->addReference('knowledge_base_tag_' . $i, $tag);
        }

        $manager->flush();
    }
}
