<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\PlayerTeamAssignment;
use App\Entity\RelationType;
use App\Entity\Team;
use App\Entity\User;
use App\Entity\UserRelation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;
use Exception;

/**
 * Demo-Fixtures: Verknüpft Demo-Benutzerkonten mit Spielern und Trainern.
 *
 * Mapping pro Verein:
 *   User localIdx 1 → Cheftrainer (self_coach)
 *   User localIdx 2 → Co-Trainer  (self_coach, nur wenn Verein ≥ 2 Senior-Trainer hat)
 *   User localIdx 3-8 → je 1 Spieler aus Senioren I (self_player)
 *   User localIdx 9 → Elternteil eines C-Junioren-Spielers (parent)
 *
 * Gruppe: demo
 */
class UserRelationFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            UserFixtures::class,
            CoachFixtures::class,
            PlayerFixtures::class,
            \App\DataFixtures\MasterData\RelationTypeFixtures::class,
        ];
    }

    /** Club 0-9 → global coach index für Cheftrainer (Senioren I) */
    private const CHEFTRAINER_IDX = [0 => 0, 1 => 5, 2 => 9, 3 => 12, 4 => 15, 5 => 18, 6 => 20, 7 => 22, 8 => 24, 9 => 25];

    /** Club 0-9 → global coach index für Co-Trainer (null = keiner) */
    private const CO_TRAINER_IDX = [0 => 1, 1 => 6, 2 => 10, 3 => 13, 4 => 16, 5 => 19, 6 => 21, 7 => 23, 8 => null, 9 => null];

    /** Club 0-9 → globalIdx des C-Junioren-Teams (für Elternteil-Verknüpfung) */
    private const C_JUNIOREN_TEAM_IDX = [0 => 4, 1 => 13, 2 => 20, 3 => 25, 4 => 30, 5 => 34, 6 => 38, 7 => 42, 8 => 45, 9 => 48];

    /**
     * Pro Verein: User-Account (localIdx 3-8) → globalIdx des Liga-Teams dessen Spieler er repräsentiert.
     * Verteilt die 6 Spieler-Accounts auf alle Liga-Teams des Vereins (~2 pro Team),
     * damit die "Teilnehmerübersicht" für jeden Spielbetrieb Mitglieder anzeigt.
     *
     * Legende: Sen-I / Sen-II / A-Jun / B-Jun / C-Jun (team globalIdx aus TeamFixtures)
     */
    private const PLAYER_USER_TEAM_MAP = [
        // Clubs 0-4 haben Sen-I, Sen-II, A-Jun, B-Jun, C-Jun
        0 => [3 => 0,  4 => 1,  5 => 2,  6 => 3,  7 => 4,  8 => 4],
        1 => [3 => 9,  4 => 10, 5 => 11, 6 => 12, 7 => 13, 8 => 13],
        2 => [3 => 16, 4 => 17, 5 => 18, 6 => 19, 7 => 20, 8 => 20],
        3 => [3 => 21, 4 => 22, 5 => 23, 6 => 24, 7 => 25, 8 => 25],
        4 => [3 => 26, 4 => 27, 5 => 28, 6 => 29, 7 => 30, 8 => 30],
        // Clubs 5-7 haben Sen-I, A-Jun, B-Jun, C-Jun (kein Sen-II)
        5 => [3 => 31, 4 => 31, 5 => 32, 6 => 33, 7 => 34, 8 => 34],
        6 => [3 => 35, 4 => 35, 5 => 36, 6 => 37, 7 => 38, 8 => 38],
        7 => [3 => 39, 4 => 39, 5 => 40, 6 => 41, 7 => 42, 8 => 42],
        // Club 8 hat Sen-I, A-Jun, C-Jun (kein Sen-II, kein B-Jun)
        8 => [3 => 43, 4 => 43, 5 => 44, 6 => 44, 7 => 45, 8 => 45],
        // Club 9 hat Sen-I, B-Jun, C-Jun (kein Sen-II, kein A-Jun)
        9 => [3 => 46, 4 => 46, 5 => 47, 6 => 47, 7 => 48, 8 => 48],
    ];

    public function load(ObjectManager $manager): void
    {
        // Idempotency: check if relations already exist
        $adminUser = $this->getReference('demo_user_0_0', User::class);
        $existingRelations = $manager->getRepository(UserRelation::class)->findBy(['user' => $adminUser]);
        if (!empty($existingRelations)) {
            return;
        }

        /** @var RelationType $selfPlayerType */
        $selfPlayerType = $this->getReference('relation_type_self_player', RelationType::class);
        /** @var RelationType $selfCoachType */
        $selfCoachType = $this->getReference('relation_type_self_coach', RelationType::class);
        /** @var RelationType $parentType */
        $parentType = $this->getReference('relation_type_parent', RelationType::class);

        for ($clubIdx = 0; $clubIdx < 10; ++$clubIdx) {
            // ── Trainer-Accounts ────────────────────────────────────────────
            $chefIdx = self::CHEFTRAINER_IDX[$clubIdx];
            /** @var Coach $chefCoach */
            $chefCoach = $this->getReference('demo_coach_' . $chefIdx, Coach::class);
            /** @var User $trainer1 */
            $trainer1 = $this->getReference('demo_user_' . $clubIdx . '_1', User::class);
            $this->createRelation($manager, $trainer1, null, $chefCoach, $selfCoachType);

            $coIdx = self::CO_TRAINER_IDX[$clubIdx];
            if (null !== $coIdx) {
                /** @var Coach $coCoach */
                $coCoach = $this->getReference('demo_coach_' . $coIdx, Coach::class);
                /** @var User $trainer2 */
                $trainer2 = $this->getReference('demo_user_' . $clubIdx . '_2', User::class);
                $this->createRelation($manager, $trainer2, null, $coCoach, $selfCoachType);
            }

            // ── Spieler-Accounts (localIdx 3-8) → verteilt auf alle Liga-Teams ──
            // Jeder Account bekommt einen Spieler aus dem zugeordneten Team,
            // damit resolveTeamMembers() für alle Spielbetriebe Mitglieder findet.
            $posPerTeam = [];
            foreach (self::PLAYER_USER_TEAM_MAP[$clubIdx] as $localUserIdx => $teamGlobalIdx) {
                $pos = $posPerTeam[$teamGlobalIdx] ?? 0;
                try {
                    /** @var Team $playerTeam */
                    $playerTeam = $this->getReference('demo_team_' . $teamGlobalIdx, Team::class);
                    $ptaList = $manager->getRepository(PlayerTeamAssignment::class)->findBy(
                        ['team' => $playerTeam],
                        [],
                        1,
                        $pos
                    );
                    if (!empty($ptaList)) {
                        /** @var User $playerUser */
                        $playerUser = $this->getReference('demo_user_' . $clubIdx . '_' . $localUserIdx, User::class);
                        $this->createRelation($manager, $playerUser, $ptaList[0]->getPlayer(), null, $selfPlayerType);
                        $posPerTeam[$teamGlobalIdx] = $pos + 1;
                    }
                } catch (Exception) {
                    continue;
                }
            }

            // ── Elternteil-Account (localIdx 9 → C-Junioren-Spieler, nach den Spieler-Accounts) ──
            $cJuniorenTeamIdx = self::C_JUNIOREN_TEAM_IDX[$clubIdx];
            try {
                /** @var Team $cJuniorenTeam */
                $cJuniorenTeam = $this->getReference('demo_team_' . $cJuniorenTeamIdx, Team::class);
                // Nimm den nächsten freien Slot nach den bereits zugewiesenen Spieler-Accounts
                $parentPos = $posPerTeam[$cJuniorenTeamIdx] ?? 0;
                $youthAssignments = $manager->getRepository(PlayerTeamAssignment::class)->findBy(
                    ['team' => $cJuniorenTeam],
                    [],
                    1,
                    $parentPos
                );
                if (!empty($youthAssignments)) {
                    /** @var User $parentUser */
                    $parentUser = $this->getReference('demo_user_' . $clubIdx . '_9', User::class);
                    $this->createRelation($manager, $parentUser, $youthAssignments[0]->getPlayer(), null, $parentType);
                }
            } catch (Exception) {
                // Skip if team reference unavailable
            }
        }

        $manager->flush();
    }

    private function createRelation(
        ObjectManager $manager,
        User $user,
        ?Player $player,
        ?Coach $coach,
        RelationType $type,
    ): void {
        $relation = new UserRelation();
        $relation->setUser($user);
        $relation->setRelationType($type);
        $relation->setPermissions([]);

        if (null !== $player) {
            $relation->setPlayer($player);
        }
        if (null !== $coach) {
            $relation->setCoach($coach);
        }

        $manager->persist($relation);
    }
}
