<?php

declare(strict_types=1);

namespace App\DataFixtures\MasterData;

use App\Entity\CompetitionCardRule;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Generische Standardregeln für Karten-Sperren pro Wettbewerbstyp.
 *
 * competition_id = NULL → gilt für alle Wettbewerbe des jeweiligen Typs.
 * Idempotent: Einträge werden anhand von (competitionType, competitionId, personType)
 * identifiziert und nur dann neu angelegt, wenn sie noch nicht existieren.
 */
class CompetitionCardRuleFixtures extends Fixture implements FixtureGroupInterface
{
    public static function getGroups(): array
    {
        return ['master'];
    }

    public function load(ObjectManager $manager): void
    {
        $defaults = [
            // competition_type | warn | suspend | susp.games | red | yellow-red | reset
            CompetitionCardRule::TYPE_LEAGUE => [4, 5, 1, 1, 1, true],
            CompetitionCardRule::TYPE_CUP => [3, 4, 1, 1, 1, true],
            CompetitionCardRule::TYPE_TOURNAMENT => [3, 4, 1, 1, 1, false],
            CompetitionCardRule::TYPE_FRIENDLY => [0, 0, 0, 0, 0, false],
        ];

        $repo = $manager->getRepository(CompetitionCardRule::class);

        foreach ($defaults as $type => [$warn, $suspend, $games, $red, $yellowRed, $reset]) {
            $existing = $repo->findOneBy([
                'competitionType' => $type,
                'competitionId' => null,
                'personType' => CompetitionCardRule::PERSON_ALL,
            ]);

            if (null !== $existing) {
                continue;
            }

            $rule = new CompetitionCardRule(
                competitionType: $type,
                competitionId: null,
                yellowWarningThreshold: $warn,
                yellowSuspensionThreshold: $suspend,
                suspensionGames: $games,
                redCardSuspensionGames: $red,
                yellowRedCardSuspensionGames: $yellowRed,
                personType: CompetitionCardRule::PERSON_ALL,
                resetAfterSuspension: $reset,
            );

            $manager->persist($rule);
        }

        $manager->flush();
    }
}
