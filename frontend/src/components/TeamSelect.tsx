import React from 'react';
import { FormControl, InputLabel, ListSubheader, MenuItem, Select } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { buildTeamMenuEntries } from '../utils/teamMenuEntries';
import type { TeamMenuItem } from '../utils/teamMenuEntries';

interface TeamSelectProps {
  teams: TeamMenuItem[];
  value: number | '';
  onChange: (id: number) => void;
  label?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  /** Minimum width applied via sx. Defaults to 180. */
  minWidth?: number;
  /** Optional extra "all teams" option rendered before the team list (e.g. "Alle Teams"). */
  allTeamsOption?: { value: ''; label: string };
}

/**
 * Reusable grouped team dropdown.
 *
 * - Renders nothing when no teams are available (and no allTeamsOption).
 * - Groups teams into "Meine Teams" / "Weitere Teams" when both groups are
 *   non-empty (based on the `assigned` field). Otherwise renders a flat list.
 * - The backend decides which teams are returned; this component simply renders them.
 */
const TeamSelect: React.FC<TeamSelectProps> = ({
  teams,
  value,
  onChange,
  label = 'Team',
  size = 'small',
  fullWidth = false,
  minWidth = 180,
  allTeamsOption,
}) => {
  if (teams.length === 0 && !allTeamsOption) return null;

  const entries = buildTeamMenuEntries(teams);
  const labelId = `team-select-label-${label.replace(/\s/g, '-')}`;

  const handleChange = (e: SelectChangeEvent<number | ''>) => {
    const v = e.target.value;
    // When allTeamsOption is selected (value=''), report 0 to indicate "global / no team"
    onChange(v === '' ? 0 : Number(v));
  };

  return (
    <FormControl size={size} fullWidth={fullWidth} sx={{ minWidth }}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select<number | ''> labelId={labelId} label={label} value={value} onChange={handleChange}>
        {allTeamsOption && (
          <MenuItem value={allTeamsOption.value}>{allTeamsOption.label}</MenuItem>
        )}
        {entries.map(entry =>
          entry.type === 'header'
            ? <ListSubheader key={entry.key}>{entry.label}</ListSubheader>
            : (
              <MenuItem
                key={entry.team.id}
                value={entry.team.id}
                sx={entry.dimmed ? { color: 'text.secondary' } : undefined}
              >
                {entry.team.name}
              </MenuItem>
            ),
        )}
      </Select>
    </FormControl>
  );
};

export default TeamSelect;
