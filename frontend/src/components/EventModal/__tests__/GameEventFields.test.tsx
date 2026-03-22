import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GameEventFields } from '../GameEventFields';
import { EventData } from '../../../types/event';

// ── MUI mocks ──────────────────────────────────────────────────────────────
jest.mock('@mui/material/FormControl', () => (props: any) => <div>{props.children}</div>);
jest.mock('@mui/material/InputLabel',  () => (props: any) => <label htmlFor={props.id}>{props.children}</label>);
jest.mock('@mui/material/Select', () => (props: any) => (
  <select
    data-testid={props.labelId}
    value={props.value}
    onChange={e => props.onChange(e)}
  >
    {props.children}
  </select>
));
jest.mock('@mui/material/MenuItem', () => (props: any) => {
  const { value, children } = props;
  // Unwrap a single React element wrapper (e.g. <em>) to avoid invalid <option> content
  const content = children && typeof children === 'object' && children.props
    ? children.props.children
    : children;
  return <option value={value}>{content}</option>;
});

// ── Fixtures ──────────────────────────────────────────────────────────────
const baseFormData: EventData = {
  title: 'Spiel',
  date: '2026-03-12',
};

const teams = [
  { value: '1', label: 'U19' },
  { value: '2', label: 'Erste Mannschaft' },
];

const gameTypes = [
  { value: 'liga', label: 'Ligaspiel' },
  { value: 'pokal', label: 'Pokalspiel' },
];

const leagues = [
  { value: '10', label: 'Kreisliga A' },
  { value: '11', label: 'Bezirksliga' },
];

const cups = [
  { value: '20', label: 'Kreispokal' },
  { value: '21', label: 'Stadtpokal' },
];

const baseProps = {
  formData: baseFormData,
  teams,
  gameTypes,
  leagues,
  cups,
  isTournament: false,
  isTournamentEventType: false,
  isLiga: false,
  isPokal: false,
  handleChange: jest.fn(),
};

describe('GameEventFields', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Home / Away Teams ────────────────────────────────────────────────────

  it('shows home and away team selects when not a tournament', () => {
    render(<GameEventFields {...baseProps} />);
    expect(screen.getByTestId('home-team-label')).toBeInTheDocument();
    expect(screen.getByTestId('away-team-label')).toBeInTheDocument();
  });

  it('hides home and away team selects when isTournament=true', () => {
    render(<GameEventFields {...baseProps} isTournament={true} />);
    expect(screen.queryByTestId('home-team-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('away-team-label')).not.toBeInTheDocument();
  });

  // ── Game type ────────────────────────────────────────────────────────────

  it('shows game type select when gameTypes is non-empty and not a tournament event type', () => {
    render(<GameEventFields {...baseProps} />);
    expect(screen.getByTestId('game-type-label')).toBeInTheDocument();
  });

  it('hides game type select when isTournamentEventType=true', () => {
    render(<GameEventFields {...baseProps} isTournamentEventType={true} />);
    expect(screen.queryByTestId('game-type-label')).not.toBeInTheDocument();
  });

  // ── Liga dropdown ────────────────────────────────────────────────────────

  it('shows Liga dropdown when isLiga=true and leagues available', () => {
    render(<GameEventFields {...baseProps} isLiga={true} />);
    expect(screen.getByTestId('league-label')).toBeInTheDocument();
  });

  it('hides Liga dropdown when isLiga=false', () => {
    render(<GameEventFields {...baseProps} isLiga={false} />);
    expect(screen.queryByTestId('league-label')).not.toBeInTheDocument();
  });

  it('hides Liga dropdown when leagues is empty even if isLiga=true', () => {
    render(<GameEventFields {...baseProps} isLiga={true} leagues={[]} />);
    expect(screen.queryByTestId('league-label')).not.toBeInTheDocument();
  });

  it('hides Liga dropdown when isTournament=true even if isLiga=true', () => {
    render(<GameEventFields {...baseProps} isLiga={true} isTournament={true} />);
    expect(screen.queryByTestId('league-label')).not.toBeInTheDocument();
  });

  it('calls handleChange with leagueId on Liga select change', () => {
    const handleChange = jest.fn();
    render(<GameEventFields {...baseProps} isLiga={true} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('league-label'), { target: { value: '10' } });
    expect(handleChange).toHaveBeenCalledWith('leagueId', '10');
  });

  it('renders league options', () => {
    render(<GameEventFields {...baseProps} isLiga={true} />);
    expect(screen.getByText('Kreisliga A')).toBeInTheDocument();
    expect(screen.getByText('Bezirksliga')).toBeInTheDocument();
  });

  // ── Pokal dropdown ───────────────────────────────────────────────────────

  it('shows Pokal dropdown when isPokal=true and cups available', () => {
    render(<GameEventFields {...baseProps} isPokal={true} />);
    expect(screen.getByTestId('cup-label')).toBeInTheDocument();
  });

  it('hides Pokal dropdown when isPokal=false', () => {
    render(<GameEventFields {...baseProps} isPokal={false} />);
    expect(screen.queryByTestId('cup-label')).not.toBeInTheDocument();
  });

  it('hides Pokal dropdown when cups is empty even if isPokal=true', () => {
    render(<GameEventFields {...baseProps} isPokal={true} cups={[]} />);
    expect(screen.queryByTestId('cup-label')).not.toBeInTheDocument();
  });

  it('hides Pokal dropdown when isTournament=true even if isPokal=true', () => {
    render(<GameEventFields {...baseProps} isPokal={true} isTournament={true} />);
    expect(screen.queryByTestId('cup-label')).not.toBeInTheDocument();
  });

  it('calls handleChange with cupId on Pokal select change', () => {
    const handleChange = jest.fn();
    render(<GameEventFields {...baseProps} isPokal={true} handleChange={handleChange} />);
    fireEvent.change(screen.getByTestId('cup-label'), { target: { value: '20' } });
    expect(handleChange).toHaveBeenCalledWith('cupId', '20');
  });

  it('renders cup options', () => {
    render(<GameEventFields {...baseProps} isPokal={true} />);
    expect(screen.getByText('Kreispokal')).toBeInTheDocument();
    expect(screen.getByText('Stadtpokal')).toBeInTheDocument();
  });

  // ── Liga and Pokal mutual visibility ────────────────────────────────────

  it('shows only Liga when isLiga=true, isPokal=false', () => {
    render(<GameEventFields {...baseProps} isLiga={true} isPokal={false} />);
    expect(screen.getByTestId('league-label')).toBeInTheDocument();
    expect(screen.queryByTestId('cup-label')).not.toBeInTheDocument();
  });

  it('shows only Pokal when isPokal=true, isLiga=false', () => {
    render(<GameEventFields {...baseProps} isLiga={false} isPokal={true} />);
    expect(screen.queryByTestId('league-label')).not.toBeInTheDocument();
    expect(screen.getByTestId('cup-label')).toBeInTheDocument();
  });

  it('shows neither when isLiga=false AND isPokal=false', () => {
    render(<GameEventFields {...baseProps} isLiga={false} isPokal={false} />);
    expect(screen.queryByTestId('league-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cup-label')).not.toBeInTheDocument();
  });
});
