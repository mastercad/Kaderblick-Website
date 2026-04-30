<?php

namespace App\DataFixtures\MasterData;

use App\Entity\KnowledgeBaseCategory;
use App\Repository\KnowledgeBaseCategoryRepository;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

class KnowledgeBaseCategoryFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $categories = [
            ['icon' => '🎯', 'name' => 'Taktik',              'sort' => 10],
            ['icon' => '🏃', 'name' => 'Training',            'sort' => 20],
            ['icon' => '📊', 'name' => 'Spielanalyse',        'sort' => 30],
            ['icon' => '💪', 'name' => 'Athletik & Fitness',  'sort' => 40],
            ['icon' => '🥗', 'name' => 'Ernährung',           'sort' => 50],
            ['icon' => '🧠', 'name' => 'Mentales Training',   'sort' => 60],
            ['icon' => '🏥', 'name' => 'Verletzung & Reha',   'sort' => 70],
            ['icon' => '📋', 'name' => 'Regelkunde',          'sort' => 80],
            ['icon' => '🎥', 'name' => 'Videoanalyse',        'sort' => 90],
            ['icon' => '📣', 'name' => 'Kommunikation',       'sort' => 100],
        ];

        /** @var KnowledgeBaseCategoryRepository $repo */
        $repo = $manager->getRepository(KnowledgeBaseCategory::class);

        foreach ($categories as $i => $data) {
            // Globale Kategorien (team = null) werden anhand des Namens identifiziert
            $category = $repo->findOneBy(['name' => $data['name'], 'team' => null]);

            if (null === $category) {
                $category = new KnowledgeBaseCategory();
                $category->setName($data['name']);
                $manager->persist($category);
            }

            $category->setIcon($data['icon']);
            $category->setSortOrder($data['sort']);
            // team = null → globale Kategorie (für alle Teams verfügbar)

            $this->addReference('knowledge_base_category_' . $i, $category);
        }

        $manager->flush();
    }
}
