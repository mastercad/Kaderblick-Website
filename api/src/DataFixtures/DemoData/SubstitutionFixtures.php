<?php

namespace App\DataFixtures\DemoData;

use App\Entity\Game;
use App\Entity\Player;
use App\Entity\Substitution;
use App\Entity\SubstitutionReason;
use App\Entity\Team;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Bundle\FixturesBundle\FixtureGroupInterface;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;
use RuntimeException;

/**
 * Demo-Fixtures: Auswechslungen für alle abgeschlossenen Spiele.
 *
 * Erstellt pro abgeschlossenem Spiel:
 * - 1-2 Auswechslungen je Mannschaft (gesamt 2-4 pro Spiel)
 * - Teilnahme-Minuten gestaffelt: erste Auswechslung ~60-70 min, zweite ~77-89 min
 * - Zufällige SubstitutionReasons aus MasterData
 *
 * Gruppe: demo
 */
class SubstitutionFixtures extends Fixture implements FixtureGroupInterface, DependentFixtureInterface
{
    private const BATCH_SIZE = 200;

    public static function getGroups(): array
    {
        return ['demo'];
    }

    public function getDependencies(): array
    {
        return [
            GameFixtures::class,
            PlayerFixtures::class,
            \App\DataFixtures\MasterData\SubstitutionReasonFixtures::class,
        ];
    }

    public function load(ObjectManager $manager): void
    {
        assert($manager instanceof EntityManagerInterface);

        // ── SubstitutionReasons aus DB laden ─────────────────────────────────
        $allReasons = $manager->getRepository(SubstitutionReason::class)->findAll();
        if (empty($allReasons)) {
            throw new RuntimeException('Keine SubstitutionReasons gefunden. MasterData zuerst laden.');
        }
        /** @var int[] $reasonIds */
        $reasonIds = array_values(array_filter(
            array_map(fn (SubstitutionReason $r) => $r->getId(), $allReasons)
        ));

        // ── Spieler pro Team aus DB laden ─────────────────────────────────────
        $ptaRows = $manager->createQuery(
            'SELECT IDENTITY(pta.player) AS playerId, IDENTITY(pta.team) AS teamId
             FROM App\Entity\PlayerTeamAssignment pta
             WHERE pta.endDate IS NULL'
        )->getArrayResult();

        /** @var array<int, int[]> $teamPlayerMap teamId => [playerId, ...] */
        $teamPlayerMap = [];
        foreach ($ptaRows as $row) {
            $teamPlayerMap[(int) $row['teamId']][] = (int) $row['playerId'];
        }
        unset($ptaRows);

        // ── Idempotenz: bereits verarbeitete Spiele überspringen ─────────────
        $existingGameIds = [];
        $existing = $manager->createQuery(
            'SELECT DISTINCT IDENTITY(s.game) AS gameId FROM App\Entity\Substitution s'
        )->getArrayResult();
        foreach ($existing as $row) {
            $existingGameIds[(int) $row['gameId']] = true;
        }
        unset($existing);

        // ── Alle abgeschlossenen Spiele laden ────────────────────────────────
        $gamesData = $manager->createQuery(
            'SELECT g.id, IDENTITY(g.homeTeam) AS homeTeamId, IDENTITY(g.awayTeam) AS awayTeamId
             FROM App\Entity\Game g
             WHERE g.isFinished = true
             ORDER BY g.id ASC'
        )->getArrayResult();

        $count = 0;

        foreach ($gamesData as $gameRow) {
            $gameId = (int) $gameRow['id'];
            if (isset($existingGameIds[$gameId])) {
                continue;
            }

            $homeTeamId = (int) $gameRow['homeTeamId'];
            $awayTeamId = (int) $gameRow['awayTeamId'];
            $homePlayers = $teamPlayerMap[$homeTeamId] ?? [];
            $awayPlayers = $teamPlayerMap[$awayTeamId] ?? [];

            // Mindestens 4 Spieler pro Team nötig
            if (count($homePlayers) < 4 || count($awayPlayers) < 4) {
                continue;
            }

            /** @var Game $gameProxy */
            $gameProxy = $manager->getReference(Game::class, $gameId);
            /** @var Team $homeProxy */
            $homeProxy = $manager->getReference(Team::class, $homeTeamId);
            /** @var Team $awayProxy */
            $awayProxy = $manager->getReference(Team::class, $awayTeamId);

            // ── Heimmannschaft: 1-2 Auswechslungen ──────────────────────────
            $this->createTeamSubstitutions(
                $manager,
                $gameProxy,
                $homeProxy,
                $homePlayers,
                $reasonIds,
                $count
            );

            // ── Auswärtsmannschaft: 1-2 Auswechslungen ──────────────────────
            $this->createTeamSubstitutions(
                $manager,
                $gameProxy,
                $awayProxy,
                $awayPlayers,
                $reasonIds,
                $count
            );

            if ($count > 0 && 0 === $count % self::BATCH_SIZE) {
                $manager->flush();
                $manager->clear();
            }
        }

        $manager->flush();
    }

    /**
     * Erstellt 1-2 Auswechslungen für ein Team in einem Spiel.
     *
     * @param int[] $playerIds
     * @param int[] $reasonIds
     */
    private function createTeamSubstitutions(
        EntityManagerInterface $manager,
        Game $game,
        Team $team,
        array $playerIds,
        array $reasonIds,
        int &$count
    ): void {
        $numSubs = random_int(1, 2);

        // Spieler shufflen; erste $numSubs kommen raus, nächste $numSubs kommen rein
        shuffle($playerIds);
        $needed = $numSubs * 2;
        if (count($playerIds) < $needed) {
            $numSubs = (int) floor(count($playerIds) / 2);
        }
        if ($numSubs < 1) {
            return;
        }

        $minutes = $this->pickSubMinutes($numSubs);

        for ($i = 0; $i < $numSubs; ++$i) {
            $playerOutId = $playerIds[$i];
            $playerInId = $playerIds[$numSubs + $i];

            /** @var Player $playerOut */
            $playerOut = $manager->getReference(Player::class, $playerOutId);
            /** @var Player $playerIn */
            $playerIn = $manager->getReference(Player::class, $playerInId);
            /** @var SubstitutionReason $reason */
            $reason = $manager->getReference(SubstitutionReason::class, $reasonIds[array_rand($reasonIds)]);

            $sub = new Substitution();
            $sub->setGame($game);
            $sub->setTeam($team);
            $sub->setPlayerOut($playerOut);
            $sub->setPlayerIn($playerIn);
            $sub->setMinute($minutes[$i]);
            $sub->setSubstitutionReason($reason);

            $manager->persist($sub);
            ++$count;
        }
    }

    /**
     * Wählt realistische Auswechsel-Minuten (gestaffelt von früh nach spät).
     *
     * @return int[]
     */
    private function pickSubMinutes(int $count): array
    {
        $pools = [
            [55, 58, 60, 62, 63, 65, 67, 68, 70, 72, 74, 75],
            [77, 79, 80, 82, 83, 85, 87, 88, 89],
        ];

        $minutes = [];
        for ($i = 0; $i < $count; ++$i) {
            $pool = $pools[min($i, count($pools) - 1)];
            $minutes[] = $pool[array_rand($pool)];
        }
        sort($minutes);

        return $minutes;
    }
}
