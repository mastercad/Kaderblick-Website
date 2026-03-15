<?php

namespace App\DataFixtures\LoadTest;

use App\DataFixtures\MasterData\RelationTypeFixtures;
use App\Entity\Coach;
use App\Entity\Player;
use App\Entity\RelationType;
use App\Entity\User;
use App\Entity\UserRelation;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * Load-Test Fixtures: Benutzer↔Spieler und Benutzer↔Trainer Verknüpfungen.
 *
 * - Spieler 0-399 → User 0-399 (self_player)
 * - Spieler 0-99 (Jugend): zusätzlich User 200-299 → parent-Relation
 * - Trainer 0-199 → User 400-599 (self_coach)
 * - Dual-Role: User 400-409 auch als self_player für Spieler 0-9 verknüpft
 *   (Trainer, die gleichzeitig noch spielen)
 * - Guardian-Relationen für Jugendspieler: User 300-399 als Erziehungsberechtigte
 *
 * Gruppe: load_test
 */
class UserRelationFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 100;

    public static function getGroups(): array
    {
        return ['load_test'];
    }

    public function getDependencies(): array
    {
        return [
            PlayerFixtures::class,
            CoachFixtures::class,
            UserFixtures::class,
            RelationTypeFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        /** @var RelationType $selfPlayerType */
        $selfPlayerType = $this->getReference('relation_type_self_player', RelationType::class);
        /** @var RelationType $selfCoachType */
        $selfCoachType = $this->getReference('relation_type_self_coach', RelationType::class);
        /** @var RelationType $parentType */
        $parentType = $this->getReference('relation_type_parent', RelationType::class);
        /** @var RelationType $guardianType */
        $guardianType = $this->getReference('relation_type_guardian', RelationType::class);

        $persistCount = 0;

        // 1) Spieler 0–399: self_player Relation → User 0–399
        for ($playerIdx = 0; $playerIdx < 400; ++$playerIdx) {
            /** @var Player $player */
            $player = $this->getReference('lt_player_' . $playerIdx, Player::class);
            /** @var User $user */
            $user = $this->getReference('lt_user_' . $playerIdx, User::class);

            $existing = $manager->getRepository(UserRelation::class)->findOneBy([
                'user' => $user,
                'player' => $player,
                'relationType' => $selfPlayerType,
            ]);
            if (!$existing) {
                $rel = new UserRelation();
                $rel->setUser($user);
                $rel->setPlayer($player);
                $rel->setRelationType($selfPlayerType);
                $rel->setPermissions(['view', 'participate']);
                $manager->persist($rel);
                ++$persistCount;
            }

            if (0 === $persistCount % self::BATCH_SIZE && $persistCount > 0) {
                $manager->flush();
            }
        }

        // 2) Jugendspieler 0–99: parent-Relation → User 200–299
        for ($playerIdx = 0; $playerIdx < 100; ++$playerIdx) {
            /** @var Player $player */
            $player = $this->getReference('lt_player_' . $playerIdx, Player::class);
            /** @var User $parentUser */
            $parentUser = $this->getReference('lt_user_' . (200 + $playerIdx), User::class);

            $existing = $manager->getRepository(UserRelation::class)->findOneBy([
                'user' => $parentUser,
                'player' => $player,
                'relationType' => $parentType,
            ]);
            if (!$existing) {
                $rel = new UserRelation();
                $rel->setUser($parentUser);
                $rel->setPlayer($player);
                $rel->setRelationType($parentType);
                $rel->setPermissions(['view']);
                $manager->persist($rel);
                ++$persistCount;
            }

            if (0 === $persistCount % self::BATCH_SIZE && $persistCount > 0) {
                $manager->flush();
            }
        }

        // 3) Jugendspieler 0–99: guardian-Relation → User 300–399 (Erziehungsberechtigte)
        for ($playerIdx = 0; $playerIdx < 100; ++$playerIdx) {
            /** @var Player $player */
            $player = $this->getReference('lt_player_' . $playerIdx, Player::class);
            /** @var User $guardianUser */
            $guardianUser = $this->getReference('lt_user_' . (300 + $playerIdx), User::class);

            $existing = $manager->getRepository(UserRelation::class)->findOneBy([
                'user' => $guardianUser,
                'player' => $player,
                'relationType' => $guardianType,
            ]);
            if (!$existing) {
                $rel = new UserRelation();
                $rel->setUser($guardianUser);
                $rel->setPlayer($player);
                $rel->setRelationType($guardianType);
                $rel->setPermissions(['view', 'contact']);
                $manager->persist($rel);
                ++$persistCount;
            }

            if (0 === $persistCount % self::BATCH_SIZE && $persistCount > 0) {
                $manager->flush();
            }
        }

        // 4) Trainer 0–199: self_coach Relation → User 400–599
        for ($coachIdx = 0; $coachIdx < 200; ++$coachIdx) {
            /** @var Coach $coach */
            $coach = $this->getReference('lt_coach_' . $coachIdx, Coach::class);
            /** @var User $user */
            $user = $this->getReference('lt_user_' . (400 + $coachIdx), User::class);

            $existing = $manager->getRepository(UserRelation::class)->findOneBy([
                'user' => $user,
                'coach' => $coach,
                'relationType' => $selfCoachType,
            ]);
            if (!$existing) {
                $rel = new UserRelation();
                $rel->setUser($user);
                $rel->setCoach($coach);
                $rel->setRelationType($selfCoachType);
                $rel->setPermissions(['view', 'manage_team', 'manage_games']);
                $manager->persist($rel);
                ++$persistCount;
            }

            if (0 === $persistCount % self::BATCH_SIZE && $persistCount > 0) {
                $manager->flush();
            }
        }

        // 5) Dual-Role: User 400–409 sind gleichzeitig Spieler (Trainer, die noch spielen)
        //    → User 400+i auch als self_player für Player i verknüpft
        for ($i = 0; $i < 10; ++$i) {
            /** @var Player $player */
            $player = $this->getReference('lt_player_' . $i, Player::class);
            /** @var User $user */
            $user = $this->getReference('lt_user_' . (400 + $i), User::class);

            $existing = $manager->getRepository(UserRelation::class)->findOneBy([
                'user' => $user,
                'player' => $player,
                'relationType' => $selfPlayerType,
            ]);
            if (!$existing) {
                $rel = new UserRelation();
                $rel->setUser($user);
                $rel->setPlayer($player);
                $rel->setRelationType($selfPlayerType);
                $rel->setPermissions(['view', 'participate']);
                $manager->persist($rel);
                ++$persistCount;
            }
        }

        $manager->flush();
    }
}
