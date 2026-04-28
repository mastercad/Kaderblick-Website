import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScoreboardHeroCard from '../ScoreboardHeroCard';
import { Game } from '../../../../types/games';

// ── matchMedia mock ───────────────────────────────────────────────────────────
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// ── Stub heavy sub-components ─────────────────────────────────────────────────
jest.mock('../../../../components/WeatherIcons', () => ({
  WeatherDisplay: () => <span data-testid="weather-display" />,
}));
jest.mock('../../../../components/Location', () => () => <span data-testid="location" />);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 1,
  homeTeam: { id: 10, name: 'FC Home' },
  awayTeam: { id: 20, name: 'FC Away' },
  ...overrides,
});

const defaultProps = {
  game: makeGame(),
  homeScore: null as number | null,
  awayScore: null as number | null,
  isGameRunning: false,
  isFinished: false,
  syncing: false,
  finishing: false,
  onSyncFussballDe: jest.fn(),
  onOpenWeatherModal: jest.fn(),
  onFinishGame: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScoreboardHeroCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Team names ──────────────────────────────────────────────────────────

  it('renders home and away team names', () => {
    render(<ScoreboardHeroCard {...defaultProps} />);
    expect(screen.getByText('FC Home')).toBeInTheDocument();
    expect(screen.getByText('FC Away')).toBeInTheDocument();
  });

  // ── Score display ───────────────────────────────────────────────────────

  it('shows "vs" when both scores are null', () => {
    render(<ScoreboardHeroCard {...defaultProps} homeScore={null} awayScore={null} />);
    expect(screen.getByText('vs')).toBeInTheDocument();
  });

  it('shows numeric scores when provided', () => {
    render(<ScoreboardHeroCard {...defaultProps} homeScore={2} awayScore={1} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('vs')).not.toBeInTheDocument();
  });

  it('shows 0:0 scores correctly', () => {
    render(<ScoreboardHeroCard {...defaultProps} homeScore={0} awayScore={0} />);
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  // ── Live banner ─────────────────────────────────────────────────────────

  it('shows the LIVE banner when isGameRunning=true', () => {
    render(<ScoreboardHeroCard {...defaultProps} isGameRunning={true} />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });

  it('does not show the LIVE banner when isGameRunning=false', () => {
    render(<ScoreboardHeroCard {...defaultProps} isGameRunning={false} />);
    expect(screen.queryByText(/^live$/i)).not.toBeInTheDocument();
  });

  // ── Date / time chips ───────────────────────────────────────────────────

  it('shows date and time chips when calendarEvent.startDate is provided', () => {
    const game = makeGame({
      calendarEvent: {
        id: 1,
        startDate: '2025-07-16T14:00:00.000Z',
        endDate: '2025-07-16T16:00:00.000Z',
        calendarEventType: { id: 1, name: 'Spiel' },
      },
    });
    render(<ScoreboardHeroCard {...defaultProps} game={game} />);
    // The date chip exists (contains the year)
    expect(screen.getByText(/2025/)).toBeInTheDocument();
    // The time chip exists (contains "Uhr")
    expect(screen.getByText(/Uhr/)).toBeInTheDocument();
  });

  it('does not show date or time chips when no calendarEvent', () => {
    const game = makeGame({ calendarEvent: undefined });
    render(<ScoreboardHeroCard {...defaultProps} game={game} />);
    expect(screen.queryByText(/2025/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Uhr/)).not.toBeInTheDocument();
  });

  // ── Location ────────────────────────────────────────────────────────────

  it('renders the Location component when game.location is set', () => {
    const game = makeGame({
      location: { id: 1, name: 'Stadion', address: 'Musterstraße 1' },
    });
    render(<ScoreboardHeroCard {...defaultProps} game={game} />);
    expect(screen.getByTestId('location')).toBeInTheDocument();
  });

  it('does not render Location when game.location is absent', () => {
    render(<ScoreboardHeroCard {...defaultProps} game={makeGame({ location: undefined })} />);
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  // ── Fussball.de sync ────────────────────────────────────────────────────

  it('shows the sync button when game.fussballDeUrl is set', () => {
    const game = makeGame({ fussballDeUrl: 'https://fussball.de/game/1' });
    render(<ScoreboardHeroCard {...defaultProps} game={game} />);
    expect(screen.getByRole('button', { name: /synchronisieren/i })).toBeInTheDocument();
  });

  it('does not show the sync button when game.fussballDeUrl is absent', () => {
    render(<ScoreboardHeroCard {...defaultProps} game={makeGame({ fussballDeUrl: undefined })} />);
    expect(screen.queryByRole('button', { name: /synchronisieren/i })).not.toBeInTheDocument();
  });

  it('disables the sync button while syncing', () => {
    const game = makeGame({ fussballDeUrl: 'https://fussball.de/game/1' });
    render(<ScoreboardHeroCard {...defaultProps} game={game} syncing={true} />);
    const btn = screen.getByRole('button', { name: /synchronis/i });
    expect(btn).toBeDisabled();
  });

  it('calls onSyncFussballDe when sync button is clicked', () => {
    const onSync = jest.fn();
    const game = makeGame({ fussballDeUrl: 'https://fussball.de/game/1' });
    render(<ScoreboardHeroCard {...defaultProps} game={game} onSyncFussballDe={onSync} />);
    fireEvent.click(screen.getByRole('button', { name: /synchronisieren/i }));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  // ── Finish game ─────────────────────────────────────────────────────────

  it('shows the "Spiel beenden" button when can_finish_game=true and not finished', () => {
    const game = makeGame({ permissions: { can_finish_game: true } });
    render(<ScoreboardHeroCard {...defaultProps} game={game} isFinished={false} />);
    expect(screen.getByRole('button', { name: /spiel beenden/i })).toBeInTheDocument();
  });

  it('does NOT show "Spiel beenden" when can_finish_game=false', () => {
    const game = makeGame({ permissions: { can_finish_game: false } });
    render(<ScoreboardHeroCard {...defaultProps} game={game} isFinished={false} />);
    expect(screen.queryByRole('button', { name: /spiel beenden/i })).not.toBeInTheDocument();
  });

  it('does NOT show "Spiel beenden" when isFinished=true (even if permitted)', () => {
    const game = makeGame({ permissions: { can_finish_game: true } });
    render(<ScoreboardHeroCard {...defaultProps} game={game} isFinished={true} />);
    expect(screen.queryByRole('button', { name: /spiel beenden/i })).not.toBeInTheDocument();
  });

  it('disables "Spiel beenden" button while finishing', () => {
    const game = makeGame({ permissions: { can_finish_game: true } });
    render(<ScoreboardHeroCard {...defaultProps} game={game} finishing={true} />);
    const btn = screen.getByRole('button', { name: /wird beendet/i });
    expect(btn).toBeDisabled();
  });

  it('calls onFinishGame when "Spiel beenden" is clicked', () => {
    const onFinish = jest.fn();
    const game = makeGame({ permissions: { can_finish_game: true } });
    render(<ScoreboardHeroCard {...defaultProps} game={game} onFinishGame={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: /spiel beenden/i }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  // ── isFinished indicator ────────────────────────────────────────────────

  it('shows "Spiel beendet" indicator when isFinished=true', () => {
    render(<ScoreboardHeroCard {...defaultProps} isFinished={true} />);
    expect(screen.getByText(/spiel beendet/i)).toBeInTheDocument();
  });

  it('does not show "Spiel beendet" when isFinished=false', () => {
    render(<ScoreboardHeroCard {...defaultProps} isFinished={false} />);
    expect(screen.queryByText(/spiel beendet/i)).not.toBeInTheDocument();
  });

  // ── Weather ─────────────────────────────────────────────────────────────

  it('renders the weather display', () => {
    render(<ScoreboardHeroCard {...defaultProps} />);
    expect(screen.getByTestId('weather-display')).toBeInTheDocument();
  });

  it('calls onOpenWeatherModal when weather area is clicked', () => {
    const onWeather = jest.fn();
    render(<ScoreboardHeroCard {...defaultProps} onOpenWeatherModal={onWeather} />);
    fireEvent.click(screen.getByTestId('weather-display'));
    expect(onWeather).toHaveBeenCalledTimes(1);
  });
});
