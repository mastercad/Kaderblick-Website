<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Backfill team_id for existing formations that have team_id IS NULL.
 *
 * The formation_data JSON column contains players[].playerId and bench[].playerId.
 * For each formation without a team_id, the first resolvable player ID is used to
 * look up the team via player_team_assignments. This works because all players in
 * one formation always belong to exactly one team.
 */
final class Version20260421120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Backfill team_id on formations from player IDs stored in the formation_data JSON blob';
    }

    public function up(Schema $schema): void
    {
        $formations = $this->connection->fetchAllAssociative(
            'SELECT id, formation_data FROM formations WHERE team_id IS NULL AND formation_data IS NOT NULL'
        );

        foreach ($formations as $row) {
            $data = json_decode((string) $row['formation_data'], true);
            if (!is_array($data)) {
                continue;
            }

            $playerIds = [];
            foreach (($data['players'] ?? []) as $p) {
                if (!empty($p['playerId'])) {
                    $playerIds[] = (int) $p['playerId'];
                }
            }
            foreach (($data['bench'] ?? []) as $p) {
                if (!empty($p['playerId'])) {
                    $playerIds[] = (int) $p['playerId'];
                }
            }

            if (empty($playerIds)) {
                continue;
            }

            foreach ($playerIds as $playerId) {
                $teamId = $this->connection->fetchOne(
                    'SELECT team_id FROM player_team_assignments WHERE player_id = ? LIMIT 1',
                    [$playerId]
                );

                if (false !== $teamId && null !== $teamId) {
                    $this->connection->executeStatement(
                        'UPDATE formations SET team_id = ? WHERE id = ?',
                        [(int) $teamId, (int) $row['id']]
                    );
                    break;
                }
            }
        }
    }

    public function down(Schema $schema): void
    {
        // Intentionally empty: the original team_id values (all NULL) cannot be
        // restored without knowing which rows were actually backfilled.
    }
}
