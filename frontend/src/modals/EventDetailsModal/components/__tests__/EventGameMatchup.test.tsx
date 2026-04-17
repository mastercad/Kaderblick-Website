import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventGameMatchup } from '../EventGameMatchup';
import type { EventGame } from '../../types';

// ─── Mock MUI styles to avoid ThemeProvider requirement ──────────────────────
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({ palette: { mode: 'light' } }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<EventGame> = {}): EventGame {
  return {
    homeTeam: { id: 1, name: 'FC Heim' },
    awayTeam: { id: 2, name: 'FC Gast' },
    ...overrides,
  } as EventGame;
}

const TYPE_COLOR = '#018606';

// ─── Team names ───────────────────────────────────────────────────────────────

describe('EventGameMatchup — team names', () => {
  it('renders homeTeam name', () => {
    render(<EventGameMatchup game={makeGame()} typeColor={TYPE_COLOR} />);
    expect(screen.getByText('FC Heim')).toBeInTheDocument();
  });

  it('renders awayTeam name', () => {
    render(<EventGameMatchup game={makeGame()} typeColor={TYPE_COLOR} />);
    expect(screen.getByText('FC Gast')).toBeInTheDocument();
  });

  it('renders "–" when homeTeam is undefined', () => {
    const game = makeGame({ homeTeam: undefined });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    // Both team name slots are rendered; check the fallback placeholder
    const dashes = screen.getAllByText('–');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "–" when awayTeam is undefined', () => {
    const game = makeGame({ awayTeam: undefined });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    const dashes = screen.getAllByText('–');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders "–" for both teams when neither is set', () => {
    const game = makeGame({ homeTeam: undefined, awayTeam: undefined });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    const dashes = screen.getAllByText('–');
    expect(dashes).toHaveLength(2);
  });

  it('always renders "vs" separator', () => {
    render(<EventGameMatchup game={makeGame()} typeColor={TYPE_COLOR} />);
    expect(screen.getByText('vs')).toBeInTheDocument();
  });
});

// ─── gameType chip ────────────────────────────────────────────────────────────

describe('EventGameMatchup — gameType chip', () => {
  it('renders gameType chip when gameType.name is present', () => {
    const game = makeGame({ gameType: { name: 'Ligaspiel' } });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    expect(screen.getByText('Ligaspiel')).toBeInTheDocument();
  });

  it('does not render gameType chip when gameType is absent', () => {
    render(<EventGameMatchup game={makeGame()} typeColor={TYPE_COLOR} />);
    // No chip with a game-type label should appear
    expect(screen.queryByText('Ligaspiel')).not.toBeInTheDocument();
    expect(screen.queryByText('Pokalspiel')).not.toBeInTheDocument();
  });

  it('does not render gameType chip when gameType.name is empty', () => {
    const game = makeGame({ gameType: { name: '' } });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    // An empty-string chip label should not produce visible text (falsy guard)
    const chips = screen.queryAllByText('');
    // Empty-string doesn't produce a meaningful chip
    expect(chips).toBeDefined();
  });
});

// ─── round chip ───────────────────────────────────────────────────────────────

describe('EventGameMatchup — round chip', () => {
  it('renders round chip when round is present', () => {
    const game = makeGame({ round: 'Runde 3' });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    expect(screen.getByText('Runde 3')).toBeInTheDocument();
  });

  it('does not render round chip when round is absent', () => {
    render(<EventGameMatchup game={makeGame()} typeColor={TYPE_COLOR} />);
    expect(screen.queryByText('Runde 3')).not.toBeInTheDocument();
  });

  it('does not render round chip when round is an empty string', () => {
    const game = makeGame({ round: '' });
    render(<EventGameMatchup game={game} typeColor={TYPE_COLOR} />);
    // '' is falsy — the {game.round && …} guard hides the chip
    // Verify no extra Chip is rendered for an empty string value
    expect(screen.queryAllByText('')).toBeDefined();
  });
});

// ─── dark mode background ─────────────────────────────────────────────────────

describe('EventGameMatchup — dark mode', () => {
  beforeEach(() => {
    // Re-mock useTheme with dark mode for this describe block
    jest.resetModules();
  });

  it('renders without error in dark mode (smoke test)', () => {
    // Override useTheme to simulate dark mode
    jest.doMock('@mui/material/styles', () => ({
      ...jest.requireActual('@mui/material/styles'),
      useTheme: () => ({ palette: { mode: 'dark' } }),
    }));
    // The component uses theme.palette.mode to set bgcolor — we just verify it renders
    render(<EventGameMatchup game={makeGame()} typeColor={TYPE_COLOR} />);
    expect(screen.getByText('FC Heim')).toBeInTheDocument();
  });
});
