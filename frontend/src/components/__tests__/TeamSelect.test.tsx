import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeamSelect from '../TeamSelect';
import type { TeamMenuItem } from '../../utils/teamMenuEntries';

// ─── MUI mock ─────────────────────────────────────────────────────────────────
// Simplified MUI mock so we can interact with the Select via a native <select>.

jest.mock('@mui/material', () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  InputLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  Select: ({
    onChange,
    value,
    children,
    labelId,
  }: {
    onChange: (e: { target: { value: string } }) => void;
    value: number | '';
    children: React.ReactNode;
    labelId?: string;
  }) => (
    <select
      aria-labelledby={labelId}
      value={value}
      onChange={e => onChange({ target: { value: e.target.value } })}
      data-testid="team-select"
    >
      {children}
    </select>
  ),
  MenuItem: ({
    value,
    children,
    sx,
  }: {
    value: string | number;
    children: React.ReactNode;
    sx?: unknown;
  }) => (
    <option value={value} data-dimmed={sx ? 'true' : 'false'}>
      {children}
    </option>
  ),
  ListSubheader: ({ children }: { children: React.ReactNode }) => (
    <optgroup label={String(children)}>{children}</optgroup>
  ),
}));

// ─── buildTeamMenuEntries mock ────────────────────────────────────────────────
// We test TeamSelect behaviour in isolation; buildTeamMenuEntries is tested
// separately in teamMenuEntries.test.ts.

const mockBuildTeamMenuEntries = jest.fn();
jest.mock('../../utils/teamMenuEntries', () => ({
  buildTeamMenuEntries: (...args: unknown[]) => mockBuildTeamMenuEntries(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEAM_A: TeamMenuItem = { id: 1, name: 'A-Team', assigned: true };
const TEAM_B: TeamMenuItem = { id: 2, name: 'B-Team', assigned: false };

const flatEntries = (teams: TeamMenuItem[]) =>
  teams.map(t => ({ type: 'item' as const, team: t, dimmed: false }));

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildTeamMenuEntries.mockImplementation(flatEntries);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TeamSelect', () => {
  // ─── null render ───────────────────────────────────────────────────────────

  it('renders nothing when teams is empty and no allTeamsOption', () => {
    const { container } = render(
      <TeamSelect teams={[]} value="" onChange={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // ─── renders with allTeamsOption ──────────────────────────────────────────

  it('renders when teams is empty but allTeamsOption is provided', () => {
    render(
      <TeamSelect
        teams={[]}
        value=""
        onChange={jest.fn()}
        allTeamsOption={{ value: '', label: 'Alle Teams' }}
      />,
    );
    expect(screen.getByTestId('team-select')).toBeInTheDocument();
  });

  it('renders the allTeamsOption label as the first option', () => {
    render(
      <TeamSelect
        teams={[TEAM_A]}
        value=""
        onChange={jest.fn()}
        allTeamsOption={{ value: '', label: 'Global (kein Team)' }}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Global (kein Team)');
  });

  it('renders allTeamsOption before team items', () => {
    render(
      <TeamSelect
        teams={[TEAM_A]}
        value=""
        onChange={jest.fn()}
        allTeamsOption={{ value: '', label: 'Alle' }}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Alle');
    expect(options[1]).toHaveTextContent('A-Team');
  });

  // ─── onChange: '' → 0 ─────────────────────────────────────────────────────

  it('calls onChange with 0 when allTeamsOption is selected (value empty string)', () => {
    const onChange = jest.fn();
    render(
      <TeamSelect
        teams={[TEAM_A]}
        value={1}
        onChange={onChange}
        allTeamsOption={{ value: '', label: 'Alle' }}
      />,
    );
    const select = screen.getByTestId('team-select');
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  // ─── onChange: team id ────────────────────────────────────────────────────

  it('calls onChange with the numeric team id when a team is selected', () => {
    const onChange = jest.fn();
    render(
      <TeamSelect teams={[TEAM_A, TEAM_B]} value="" onChange={onChange} />,
    );
    const select = screen.getByTestId('team-select');
    fireEvent.change(select, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('calls onChange once per change event', () => {
    const onChange = jest.fn();
    render(<TeamSelect teams={[TEAM_A]} value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('team-select'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // ─── team items ───────────────────────────────────────────────────────────

  it('renders team names as options', () => {
    render(<TeamSelect teams={[TEAM_A, TEAM_B]} value={1} onChange={jest.fn()} />);
    expect(screen.getByRole('option', { name: 'A-Team' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B-Team' })).toBeInTheDocument();
  });

  // ─── group headers ────────────────────────────────────────────────────────

  it('renders ListSubheader entries when buildTeamMenuEntries returns headers', () => {
    mockBuildTeamMenuEntries.mockReturnValue([
      { type: 'header', key: 'grp-my', label: 'Meine Teams' },
      { type: 'item', team: TEAM_A, dimmed: false },
      { type: 'header', key: 'grp-other', label: 'Weitere Teams' },
      { type: 'item', team: TEAM_B, dimmed: true },
    ]);

    render(<TeamSelect teams={[TEAM_A, TEAM_B]} value={1} onChange={jest.fn()} />);

    // ListSubheader is rendered as <optgroup label="...">
    expect(screen.getByRole('group', { name: 'Meine Teams' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Weitere Teams' })).toBeInTheDocument();
  });

  // ─── dimmed items ─────────────────────────────────────────────────────────

  it('passes sx prop to dimmed MenuItem items', () => {
    mockBuildTeamMenuEntries.mockReturnValue([
      { type: 'item', team: TEAM_A, dimmed: false },
      { type: 'item', team: TEAM_B, dimmed: true },
    ]);

    render(<TeamSelect teams={[TEAM_A, TEAM_B]} value={1} onChange={jest.fn()} />);

    const optionA = screen.getByRole('option', { name: 'A-Team' });
    const optionB = screen.getByRole('option', { name: 'B-Team' });

    expect(optionA).toHaveAttribute('data-dimmed', 'false');
    expect(optionB).toHaveAttribute('data-dimmed', 'true');
  });

  // ─── passes teams to buildTeamMenuEntries ─────────────────────────────────

  it('calls buildTeamMenuEntries with the provided teams', () => {
    render(<TeamSelect teams={[TEAM_A, TEAM_B]} value={1} onChange={jest.fn()} />);
    expect(mockBuildTeamMenuEntries).toHaveBeenCalledWith([TEAM_A, TEAM_B]);
  });

  it('does not call buildTeamMenuEntries when rendering nothing (no teams, no allTeamsOption)', () => {
    render(<TeamSelect teams={[]} value="" onChange={jest.fn()} />);
    expect(mockBuildTeamMenuEntries).not.toHaveBeenCalled();
  });
});
