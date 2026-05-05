import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GameEventsSection from '../GameEventsSection';
import { Game, GameEvent } from '../../../../types/games';

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

// ── Stub dependencies ─────────────────────────────────────────────────────────
jest.mock('../../../../components/UserAvatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <span data-testid="user-avatar">{name}</span>,
}));
jest.mock('../../../../constants/gameEventIcons', () => ({
  getGameEventIconByCode: () => <span data-testid="event-icon" />,
}));
jest.mock('../../../../utils/formatter', () => ({
  formatEventTime: () => '45:00',
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 1,
  homeTeam: { id: 10, name: 'FC Home' },
  awayTeam: { id: 20, name: 'FC Away' },
  ...overrides,
});

const makeEvent = (overrides: Partial<any> = {}): GameEvent => ({
  id: 1,
  game: makeGame(),
  gameEventType: { id: 1, name: 'Tor', code: 'goal', color: '#00ff00', icon: 'goal' },
  player: { id: 5, firstName: 'Max', lastName: 'Müller', jerseyNumber: 9 },
  timestamp: '2025-07-16T15:45:00.000Z',
  minute: 2700, // 45 minutes in seconds
  type: 'Tor',
  ...overrides,
});

const defaultProps = {
  game: makeGame(),
  gameEvents: [] as GameEvent[],
  gameStartDate: '2025-07-16T15:00:00.000Z',
  youtubeLinks: {} as Record<number, Record<number, string>>,
  mappedCameras: {} as Record<number, string>,
  sectionsOpen: true,
  canCreateEvents: false,
  onToggle: jest.fn(),
  onProtectedEventAction: jest.fn(),
  onEditEvent: jest.fn(),
  onDeleteEvent: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameEventsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Section header ──────────────────────────────────────────────────────

  it('renders the section header with label', () => {
    render(<GameEventsSection {...defaultProps} />);
    expect(screen.getByText('Spielereignisse')).toBeInTheDocument();
  });

  it('shows the event count in the header', () => {
    const events = [makeEvent(), makeEvent({ id: 2 })];
    render(<GameEventsSection {...defaultProps} gameEvents={events} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onToggle when header is clicked', () => {
    render(<GameEventsSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('events-section-header'));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('"Event hinzufügen" button calls onProtectedEventAction', () => {
    render(<GameEventsSection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /event hinzufügen/i }));
    expect(defaultProps.onProtectedEventAction).toHaveBeenCalledTimes(1);
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  it('shows empty-state message when no events and section is open', () => {
    render(<GameEventsSection {...defaultProps} gameEvents={[]} sectionsOpen={true} />);
    expect(screen.getByText(/keine ereignisse/i)).toBeInTheDocument();
  });

  it('does not render event content when section is closed (Collapse)', () => {
    render(<GameEventsSection {...defaultProps} gameEvents={[]} sectionsOpen={false} />);
    // With unmountOnExit, the child content is not in the DOM when closed
    expect(screen.queryByText(/keine ereignisse/i)).not.toBeInTheDocument();
  });

  // ── Event rendering ─────────────────────────────────────────────────────

  it('renders the event type name', () => {
    render(<GameEventsSection {...defaultProps} gameEvents={[makeEvent()]} />);
    expect(screen.getByText('Tor')).toBeInTheDocument();
  });

  it('renders the formatted minute', () => {
    render(<GameEventsSection {...defaultProps} gameEvents={[makeEvent({ minute: 2700 })]} />);
    // minute=2700s → 45:00
    expect(screen.getByText('45:00')).toBeInTheDocument();
  });

  it('renders player name via UserAvatar', () => {
    const event = makeEvent({
      player: { id: 5, firstName: 'Max', lastName: 'Müller', jerseyNumber: 9 },
    });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} />);
    expect(screen.getByText('Max Müller')).toBeInTheDocument();
  });

  it('renders a description when present', () => {
    const event = makeEvent({ description: 'Schönes Tor aus 20 Metern' });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} />);
    expect(screen.getByText('Schönes Tor aus 20 Metern')).toBeInTheDocument();
  });

  it('does not show description element when description is absent', () => {
    const event = makeEvent({ description: undefined });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} />);
    expect(screen.queryByText(/schönes tor/i)).not.toBeInTheDocument();
  });

  // ── YouTube links ───────────────────────────────────────────────────────

  it('renders YouTube links for an event when present', () => {
    const eventId = 1;
    const youtubeLinks = { [eventId]: { 7: 'https://youtu.be/abc' } };
    const mappedCameras = { 7: 'Hauptkamera' };
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[makeEvent({ id: eventId })]}
        youtubeLinks={youtubeLinks}
        mappedCameras={mappedCameras}
      />
    );
    // Video panel is collapsed by default – toggle it first
    fireEvent.click(screen.getByRole('button', { name: /videos/i }));
    expect(screen.getByText('Hauptkamera')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /hauptkamera/i });
    expect(link).toHaveAttribute('href', 'https://youtu.be/abc');
  });

  it('does not render links when no youtubeLinks for event', () => {
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[makeEvent()]}
        youtubeLinks={{} as Record<number, Record<number, string>>}
        mappedCameras={{} as Record<number, string>}
      />
    );
    // No video toggle button when there are no videos
    expect(screen.queryByRole('button', { name: /videos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  // ── Edit / delete actions ───────────────────────────────────────────────

  it('shows edit and delete buttons when canCreateEvents=true', () => {
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[makeEvent()]}
        canCreateEvents={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /ereignis-optionen/i }));
    expect(screen.getByRole('menuitem', { name: /bearbeiten/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /löschen/i })).toBeInTheDocument();
  });

  it('hides edit and delete buttons when canCreateEvents=false', () => {
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[makeEvent()]}
        canCreateEvents={false}
      />
    );
    expect(screen.queryByRole('button', { name: /ereignis-optionen/i })).not.toBeInTheDocument();
  });

  it('calls onEditEvent with the event when edit button is clicked', () => {
    const onEdit = jest.fn();
    const event = makeEvent();
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[event]}
        canCreateEvents={true}
        onEditEvent={onEdit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /ereignis-optionen/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /bearbeiten/i }));
    expect(onEdit).toHaveBeenCalledWith(event);
  });

  it('calls onDeleteEvent with the event when delete button is clicked', () => {
    const onDelete = jest.fn();
    const event = makeEvent();
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[event]}
        canCreateEvents={true}
        onDeleteEvent={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /ereignis-optionen/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /löschen/i }));
    expect(onDelete).toHaveBeenCalledWith(event);
  });

  // ── Substitution ─────────────────────────────────────────────────────────

  it('renders substitution players for substitution event', () => {
    const event = makeEvent({
      id: 3,
      type: 'Wechsel',
      code: 'substitution',
      gameEventType: { id: 2, name: 'Wechsel', code: 'substitution', icon: 'sub' },
      player: { id: 5, firstName: 'Spieler', lastName: 'Rein', jerseyNumber: 9 },
      relatedPlayer: { id: 6, firstName: 'Spieler', lastName: 'Raus', jerseyNumber: 11 },
    });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} canCreateEvents={false} />);
    expect(screen.getByText('Spieler Rein')).toBeInTheDocument();
    expect(screen.getByText('Spieler Raus')).toBeInTheDocument();
  });

  // ── Coach-Events ────────────────────────────────────────────────────────

  it('zeigt Coach-Namen wenn kein Spieler gesetzt aber coach-String vorhanden', () => {
    const event = makeEvent({
      player: undefined,
      coach: 'Test Trainer',
      coachId: 10,
    });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} />);
    expect(screen.getByText('Test Trainer')).toBeInTheDocument();
  });

  it('zeigt keinen Coach-Namen wenn player gesetzt ist (player hat Vorrang)', () => {
    const event = makeEvent({
      player: { id: 5, firstName: 'Max', lastName: 'Müller', jerseyNumber: 9 },
      coach: 'Test Trainer',
      coachId: 10,
    });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} />);
    expect(screen.getByText('Max Müller')).toBeInTheDocument();
    expect(screen.queryByText('Test Trainer')).not.toBeInTheDocument();
  });

  it('übergibt Coach-Event vollständig an onEditEvent-Callback', () => {
    const onEdit = jest.fn();
    const event = makeEvent({
      player: undefined,
      coach: 'Test Trainer',
      coachId: 10,
    });
    render(
      <GameEventsSection
        {...defaultProps}
        gameEvents={[event]}
        canCreateEvents={true}
        onEditEvent={onEdit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /ereignis-optionen/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /bearbeiten/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ coachId: 10, coach: 'Test Trainer' }));
  });

  it('appends "(verletzt)" to the injured player name for injury substitution', () => {
    const event = makeEvent({
      id: 4,
      type: 'Wechsel (Verletzung)',
      code: 'substitution_injury',
      gameEventType: { id: 3, name: 'Wechsel (Verletzung)', code: 'substitution_injury', icon: 'injury' },
      // for non-substitution_in codes: playerOut = player, playerIn = relatedPlayer
      player: { id: 5, firstName: 'Aus', lastName: 'Spieler', jerseyNumber: 7 },
      relatedPlayer: { id: 6, firstName: 'Ein', lastName: 'Spieler', jerseyNumber: 8 },
    });
    render(<GameEventsSection {...defaultProps} gameEvents={[event]} canCreateEvents={false} />);
    expect(screen.getByText('Aus Spieler (verletzt)')).toBeInTheDocument();
  });
});
